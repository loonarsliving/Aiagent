import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetConfigCache } from "@mkh/shared";
import { AIProviderError } from "./errors";
import { getAIProvider, resetAIProviderCache } from "./registry";
import { GeminiProvider } from "./providers/gemini.provider";
import { claudeProvider } from "./providers/claude.provider";

const ENV_KEYS = ["AI_PROVIDER", "GEMINI_API_KEY"] as const;
let snapshot: Record<string, string | undefined>;

beforeEach(() => {
  snapshot = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  resetConfigCache();
  resetAIProviderCache();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
  resetConfigCache();
  resetAIProviderCache();
});

describe("getAIProvider", () => {
  it("throws a non-retryable AIProviderError when AI_PROVIDER=gemini and GEMINI_API_KEY is unset", () => {
    process.env.AI_PROVIDER = "gemini";
    resetConfigCache();
    expect(() => getAIProvider()).toThrow(AIProviderError);
    try {
      getAIProvider();
    } catch (err) {
      expect((err as AIProviderError).retryable).toBe(false);
      expect((err as AIProviderError).provider).toBe("gemini");
    }
  });

  it("returns a GeminiProvider instance once GEMINI_API_KEY is set", () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key-not-real";
    resetConfigCache();
    const provider = getAIProvider();
    expect(provider).toBeInstanceOf(GeminiProvider);
    expect(provider.name).toBe("gemini");
  });

  it("returns the claude stub when AI_PROVIDER=claude (no key required)", () => {
    process.env.AI_PROVIDER = "claude";
    resetConfigCache();
    expect(getAIProvider()).toBe(claudeProvider);
  });

  it("defaults to gemini when AI_PROVIDER is unset", () => {
    process.env.GEMINI_API_KEY = "test-key-not-real";
    resetConfigCache();
    expect(getAIProvider().name).toBe("gemini");
  });
});
