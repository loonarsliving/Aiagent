import { GoogleGenAI } from "@google/genai";
import { getConfig } from "@mkh/shared";
import { AIProviderError } from "./errors";
import { GeminiProvider } from "./providers/gemini.provider";
import { claudeProvider } from "./providers/claude.provider";
import { openaiProvider } from "./providers/openai.provider";
import { ollamaProvider } from "./providers/ollama.provider";
import type { AIProvider } from "./types";

let cachedGeminiProvider: GeminiProvider | undefined;

/**
 * Lazily constructs the Gemini provider — never at module load time, so
 * importing this package never requires GEMINI_API_KEY to be set (only
 * actually calling getAIProvider() with AI_PROVIDER=gemini does).
 */
function createGeminiProvider(): GeminiProvider {
  if (cachedGeminiProvider) return cachedGeminiProvider;

  const config = getConfig();
  if (!config.GEMINI_API_KEY) {
    throw new AIProviderError(
      "GEMINI_API_KEY is not set. Add it to your .env file (see .env.example) before using AI_PROVIDER=gemini.",
      "gemini",
      false,
    );
  }

  const client = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  cachedGeminiProvider = new GeminiProvider(client, {
    model: config.GEMINI_MODEL,
    defaultTemperature: config.AI_TEMPERATURE,
    defaultMaxOutputTokens: config.AI_MAX_OUTPUT_TOKENS,
    timeoutMs: config.AI_TIMEOUT_MS,
    safetyThreshold: config.AI_SAFETY_THRESHOLD,
  });
  return cachedGeminiProvider;
}

/**
 * Single place that decides which AIProvider implementation backs
 * AI_PROVIDER — every Digital Employee's Reasoning Engine call resolves
 * through this function, never through a concrete provider import. Mirrors
 * packages/connectors/src/registry.ts's exact pattern.
 */
export function getAIProvider(): AIProvider {
  const config = getConfig();
  switch (config.AI_PROVIDER) {
    case "gemini":
      return createGeminiProvider();
    case "claude":
      return claudeProvider;
    case "openai":
      return openaiProvider;
    case "ollama":
      return ollamaProvider;
  }
}

/** Test-only escape hatch — forces the next getAIProvider() call to rebuild the Gemini client (e.g. after mutating GEMINI_API_KEY). */
export function resetAIProviderCache(): void {
  cachedGeminiProvider = undefined;
}
