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
}

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

    try {
      const response = await Promise.race([
        this.client.models.generateContent({
          model: this.options.model,
          contents: request.userPrompt,
          config: {
            temperature: request.temperature ?? this.options.defaultTemperature,
            maxOutputTokens: request.maxOutputTokens ?? this.options.defaultMaxOutputTokens,
            systemInstruction: request.systemPrompt,
            responseMimeType: request.responseFormat === "json" ? "application/json" : undefined,
          },
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
        maxOutputTokens: 10,
        temperature: 0,
      });
      const ok = res.text.trim().length > 0;
      return { ok, detail: `model=${this.options.model} responseTimeMs=${res.responseTimeMs} text="${res.text.trim().slice(0, 40)}"` };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }
  }
}
