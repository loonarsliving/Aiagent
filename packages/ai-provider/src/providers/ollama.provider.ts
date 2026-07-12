import { AIProviderError } from "../errors";
import type { AIProvider } from "../types";

/** Guardrail stub — see claude.provider.ts for the pattern this follows. */
export const ollamaProvider: AIProvider = {
  name: "ollama",
  async generate() {
    throw new AIProviderError(
      "Ollama provider is not implemented yet — Sprint 2 activates Gemini only. Implement AIProvider for Ollama (local inference) and flip AI_PROVIDER=ollama when authorized.",
      "ollama",
      false,
    );
  },
  async healthCheck() {
    return { ok: false, detail: "Ollama provider is not implemented yet." };
  },
};
