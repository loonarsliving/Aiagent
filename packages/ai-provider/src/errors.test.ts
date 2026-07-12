import { describe, expect, it } from "vitest";
import { AIProviderError } from "./errors";

describe("AIProviderError", () => {
  it("carries provider, retryable, and an optional cause", () => {
    const cause = new Error("root cause");
    const err = new AIProviderError("boom", "gemini", true, cause);
    expect(err.name).toBe("AIProviderError");
    expect(err.message).toBe("boom");
    expect(err.provider).toBe("gemini");
    expect(err.retryable).toBe(true);
    expect(err.cause).toBe(cause);
    expect(err).toBeInstanceOf(Error);
  });

  it("defaults cause to undefined when not provided", () => {
    const err = new AIProviderError("boom", "claude", false);
    expect(err.cause).toBeUndefined();
  });
});
