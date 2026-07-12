import { AIProviderError } from "../errors";
import type { AIProvider } from "../types";

/** Guardrail stub — see claude.provider.ts for the pattern this follows. */
export const openaiProvider: AIProvider = {
  name: "openai",
  async generate() {
    throw new AIProviderError(
      "OpenAI provider is not implemented yet — Sprint 2 activates Gemini only. Implement AIProvider for OpenAI and flip AI_PROVIDER=openai when authorized.",
      "openai",
      false,
    );
  },
  async healthCheck() {
    return { ok: false, detail: "OpenAI provider is not implemented yet." };
  },
};
