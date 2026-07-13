import { createLogger } from "@mkh/shared";
import { AIProviderError } from "../errors";
import type { AIGenerateRequest, AIGenerateResponse, AIProvider } from "../types";

const logger = createLogger("ai-provider:gemini");

/**
 * The minimal slice of @google/genai's client surface this provider
 * actually calls. Kept as a narrow interface (not `GoogleGenAI` directly)
 * so tests can inject a fake client instead of hitting the real Gemini
 * API — GeminiProvider itself has zero knowledge of the SDK's full shape.
 */
export interface GeminiClientLike {
  models: {
    generateContent(params: {
      model: string;
      contents: string;
      config?: {
        temperature?: number;
        maxOutputTokens?: number;
        systemInstruction?: string;
        responseMimeType?: string;
        // Disables the model's internal "thinking" pass, which otherwise
        // consumes an unpredictable share of maxOutputTokens before any
        // visible text is emitted (observed on gemini-flash-latest).
        thinkingConfig?: { thinkingBudget?: number };
      };
    }): Promise<{
      text?: string;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    }>;
  };
}

export interface GeminiProviderOptions {
  model: string;
  defaultTemperature: number;
  defaultMaxOutputTokens: number;
  timeoutMs: number;
  /** Applied to every harm category — see AI_SAFETY_THRESHOLD in @mkh/shared's config layer. */
  safetyThreshold: string;
}

const HARM_CATEGORIES = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
] as const;

/** Real Gemini Flash implementation — the only "active" provider in Sprint 2. */
export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;

  constructor(
    private readonly client: GeminiClientLike,
    private readonly options: GeminiProviderOptions,
  ) {}

  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const startedAt = Date.now();
    const timeoutMs = this.options.timeoutMs;

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new AIProviderError(`Gemini call timed out after ${timeoutMs}ms`, "gemini", true)),
        timeoutMs,
      );
    });

    const config: NonNullable<Parameters<GeminiClientLike["models"]["generateContent"]>[0]["config"]> = {
      temperature: request.temperature ?? this.options.defaultTemperature,
      maxOutputTokens: request.maxOutputTokens ?? this.options.defaultMaxOutputTokens,
      systemInstruction: request.systemPrompt,
      responseMimeType: request.responseFormat === "json" ? "application/json" : undefined,
      thinkingConfig: { thinkingBudget: 0 },
    };
    // safetySettings isn't declared on GeminiClientLike (its category/
    // threshold enum types don't structurally match plain strings, and
    // TS string enums reject literal assignment) — injected here via type
    // erasure; the REST API accepts these exact string values regardless
    // of how the SDK's own TS types model them (verified against the SDK's
    // HarmCategory/HarmBlockThreshold enum member values directly).
    (config as Record<string, unknown>).safetySettings = HARM_CATEGORIES.map((category) => ({
      category,
      threshold: this.options.safetyThreshold,
    }));

    try {
      const response = await Promise.race([
        this.client.models.generateContent({
          model: this.options.model,
          contents: request.userPrompt,
          config,
        }),
        timeoutPromise,
      ]);

      const text = response.text ?? "";
      const usage = response.usageMetadata;

      logger.info("gemini generate() succeeded", {
        model: this.options.model,
        responseTimeMs: Date.now() - startedAt,
        promptTokens: usage?.promptTokenCount,
        completionTokens: usage?.candidatesTokenCount,
      });

      return {
        text,
        tokensUsed: usage
          ? {
              promptTokens: usage.promptTokenCount ?? 0,
              completionTokens: usage.candidatesTokenCount ?? 0,
              totalTokens: usage.totalTokenCount ?? (usage.promptTokenCount ?? 0) + (usage.candidatesTokenCount ?? 0),
            }
          : undefined,
        provider: "gemini",
        model: this.options.model,
        responseTimeMs: Date.now() - startedAt,
      };
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      logger.error("gemini generate() failed", { model: this.options.model, error: message });
      throw new AIProviderError(`Gemini generate() failed: ${message}`, "gemini", true, err);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  async healthCheck(): Promise<{ ok: boolean; detail: string }> {
    try {
      const res = await this.generate({
        systemPrompt: "You are a health check probe. Reply with exactly one word.",
        userPrompt: "Reply with exactly: OK",
        // Newer "thinking" models (e.g. gemini-flash-latest) spend part of
        // the output token budget on internal reasoning before emitting
        // visible text — 10 tokens left no room for the answer itself.
        maxOutputTokens: 64,
        temperature: 0,
      });
      const ok = res.text.trim().length > 0;
      return { ok, detail: `model=${this.options.model} responseTimeMs=${res.responseTimeMs} text="${res.text.trim().slice(0, 40)}"` };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }
  }
}
