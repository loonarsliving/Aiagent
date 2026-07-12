import { AIProviderError } from "../errors";
import type { AIProvider } from "../types";

/**
 * Guardrail stub — same pattern as connectors' mock-external-system.adapter.ts.
 * Claude is a planned future provider (AIProvider is provider-agnostic, so
 * adding it later is "implement this interface, flip AI_PROVIDER=claude");
 * until then, selecting it fails loudly instead of silently no-op-ing.
 */
export const claudeProvider: AIProvider = {
  name: "claude",
  async generate() {
    throw new AIProviderError(
      "Claude provider is not implemented yet — Sprint 2 activates Gemini only. Implement AIProvider for Claude and flip AI_PROVIDER=claude when authorized.",
      "claude",
      false,
    );
  },
  async healthCheck() {
    return { ok: false, detail: "Claude provider is not implemented yet." };
  },
};
