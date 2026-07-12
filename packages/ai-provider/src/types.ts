import type { AIProviderName } from "@mkh/shared";

export type { AIProviderName };

export interface AIGenerateRequest {
  /** System-level instructions — role, rules, output format. Never user-authored. */
  systemPrompt: string;
  /** The actual task/context for this call. */
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** "json" asks the provider to return a parseable JSON string (used by the Output Engine). */
  responseFormat?: "text" | "json";
}

export interface AITokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIGenerateResponse {
  text: string;
  tokensUsed?: AITokenUsage;
  provider: AIProviderName;
  model: string;
  responseTimeMs: number;
}

/**
 * The plug-and-play contract every Digital Employee's Reasoning Engine
 * call goes through. Business logic (packages/ai-engine/src/modules/*)
 * never imports a concrete provider — only ever this interface, resolved
 * through registry.ts's getAIProvider(). Swapping Gemini for Claude/OpenAI/
 * Ollama later means implementing this interface once and flipping
 * AI_PROVIDER in config; zero changes to any employee or to the Reasoning
 * Engine itself.
 */
export interface AIProvider {
  readonly name: AIProviderName;
  generate(request: AIGenerateRequest): Promise<AIGenerateResponse>;
  healthCheck(): Promise<{ ok: boolean; detail: string }>;
}
