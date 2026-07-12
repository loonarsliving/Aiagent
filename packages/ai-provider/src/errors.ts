import type { AIProviderName } from "./types";

/**
 * Every failure mode from a provider call surfaces as this one structured
 * error type — network failure, timeout, malformed response, or an
 * explicitly-not-implemented stub provider. `retryable` tells the caller
 * (the Reasoning Engine's retry loop) whether trying again is worthwhile;
 * "not implemented" errors are deliberately not retryable.
 */
export class AIProviderError extends Error {
  readonly provider: AIProviderName;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(message: string, provider: AIProviderName, retryable: boolean, cause?: unknown) {
    super(message);
    this.name = "AIProviderError";
    this.provider = provider;
    this.retryable = retryable;
    this.cause = cause;
  }
}
