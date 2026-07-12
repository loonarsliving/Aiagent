import { describe, expect, it } from "vitest";
import { AIProviderError } from "../errors";
import { claudeProvider } from "./claude.provider";
import { openaiProvider } from "./openai.provider";
import { ollamaProvider } from "./ollama.provider";

describe.each([
  ["claude", claudeProvider],
  ["openai", openaiProvider],
  ["ollama", ollamaProvider],
] as const)("%s provider (Sprint 2 guardrail stub)", (name, provider) => {
  it("has the correct provider name", () => {
    expect(provider.name).toBe(name);
  });

  it("generate() always throws a non-retryable AIProviderError instead of silently no-op-ing", async () => {
    await expect(provider.generate({ systemPrompt: "sys", userPrompt: "hi" })).rejects.toThrow(AIProviderError);
    try {
      await provider.generate({ systemPrompt: "sys", userPrompt: "hi" });
    } catch (err) {
      expect(err).toBeInstanceOf(AIProviderError);
      expect((err as AIProviderError).retryable).toBe(false);
      expect((err as AIProviderError).provider).toBe(name);
    }
  });

  it("healthCheck() reports ok=false", async () => {
    const result = await provider.healthCheck();
    expect(result.ok).toBe(false);
  });
});
