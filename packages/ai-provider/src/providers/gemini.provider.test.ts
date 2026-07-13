import { describe, expect, it } from "vitest";
import { AIProviderError } from "../errors";
import { GeminiProvider, type GeminiClientLike } from "./gemini.provider";

function fakeClient(overrides: Partial<GeminiClientLike["models"]> = {}): GeminiClientLike {
  return {
    models: {
      generateContent: async () => ({
        text: "OK",
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
      }),
      ...overrides,
    },
  };
}

function provider(client: GeminiClientLike, timeoutMs = 5000) {
  return new GeminiProvider(client, {
    model: "gemini-2.0-flash",
    defaultTemperature: 0.3,
    defaultMaxOutputTokens: 1024,
    timeoutMs,
    safetyThreshold: "BLOCK_MEDIUM_AND_ABOVE",
  });
}

describe("GeminiProvider.generate", () => {
  it("returns text, token usage, provider, model, and responseTimeMs on success", async () => {
    const result = await provider(fakeClient()).generate({ systemPrompt: "sys", userPrompt: "hi" });
    expect(result.text).toBe("OK");
    expect(result.tokensUsed).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    expect(result.provider).toBe("gemini");
    expect(result.model).toBe("gemini-2.0-flash");
    expect(typeof result.responseTimeMs).toBe("number");
  });

  it("passes request temperature/maxOutputTokens/systemPrompt through to the client config", async () => {
    let capturedConfig: unknown;
    const client: GeminiClientLike = {
      models: {
        generateContent: async (params) => {
          capturedConfig = params.config;
          return { text: "ok" };
        },
      },
    };
    await provider(client).generate({ systemPrompt: "You are a test.", userPrompt: "hi", temperature: 0.9, maxOutputTokens: 50 });
    expect(capturedConfig).toMatchObject({ temperature: 0.9, maxOutputTokens: 50, systemInstruction: "You are a test." });
  });

  it("applies the configured safety threshold to every harm category", async () => {
    let capturedConfig: unknown;
    const client: GeminiClientLike = {
      models: {
        generateContent: async (params) => {
          capturedConfig = params.config;
          return { text: "ok" };
        },
      },
    };
    await provider(client).generate({ systemPrompt: "sys", userPrompt: "hi" });
    const safetySettings = (capturedConfig as { safetySettings: { category: string; threshold: string }[] }).safetySettings;
    expect(safetySettings).toHaveLength(4);
    expect(safetySettings.every((s) => s.threshold === "BLOCK_MEDIUM_AND_ABOVE")).toBe(true);
    expect(safetySettings.map((s) => s.category)).toEqual([
      "HARM_CATEGORY_HARASSMENT",
      "HARM_CATEGORY_HATE_SPEECH",
      "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      "HARM_CATEGORY_DANGEROUS_CONTENT",
    ]);
  });

  it("requests JSON mime type when responseFormat is json", async () => {
    let capturedConfig: unknown;
    const client: GeminiClientLike = {
      models: {
        generateContent: async (params) => {
          capturedConfig = params.config;
          return { text: "{}" };
        },
      },
    };
    await provider(client).generate({ systemPrompt: "sys", userPrompt: "hi", responseFormat: "json" });
    expect(capturedConfig).toMatchObject({ responseMimeType: "application/json" });
  });

  it("defaults to empty text when the SDK returns no text (e.g. safety block)", async () => {
    const client: GeminiClientLike = { models: { generateContent: async () => ({}) } };
    const result = await provider(client).generate({ systemPrompt: "sys", userPrompt: "hi" });
    expect(result.text).toBe("");
    expect(result.tokensUsed).toBeUndefined();
  });

  it("wraps a client throw into a retryable AIProviderError", async () => {
    const client: GeminiClientLike = {
      models: {
        generateContent: async () => {
          throw new Error("network exploded");
        },
      },
    };
    await expect(provider(client).generate({ systemPrompt: "sys", userPrompt: "hi" })).rejects.toThrow(AIProviderError);
    try {
      await provider(client).generate({ systemPrompt: "sys", userPrompt: "hi" });
    } catch (err) {
      expect(err).toBeInstanceOf(AIProviderError);
      expect((err as AIProviderError).retryable).toBe(true);
      expect((err as AIProviderError).provider).toBe("gemini");
    }
  });

  it("times out and raises a retryable AIProviderError when the client hangs past timeoutMs", async () => {
    const client: GeminiClientLike = {
      models: {
        generateContent: () => new Promise(() => {}), // never resolves
      },
    };
    await expect(provider(client, 20).generate({ systemPrompt: "sys", userPrompt: "hi" })).rejects.toThrow(/timed out/);
  });
});

describe("GeminiProvider.healthCheck", () => {
  it("reports ok=true when the provider responds with non-empty text", async () => {
    const result = await provider(fakeClient()).healthCheck();
    expect(result.ok).toBe(true);
    expect(result.detail).toContain("gemini-2.0-flash");
  });

  it("reports ok=false with the error detail when the provider call fails", async () => {
    const client: GeminiClientLike = {
      models: {
        generateContent: async () => {
          throw new Error("auth failed");
        },
      },
    };
    const result = await provider(client).healthCheck();
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("auth failed");
  });
});
