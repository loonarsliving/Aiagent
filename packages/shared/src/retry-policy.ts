/**
 * The one exponential-backoff formula used everywhere a retry loop exists
 * in this codebase — `runEmployeeTask` (task-level retry), `runReasoning`
 * (Gemini-call-level retry), and the Job Queue (Sprint 3B). Previously
 * duplicated identically in two files; consolidated here so there is
 * exactly one place that defines what "backoff" means.
 */
export function computeBackoffMs(baseMs: number, attempt: number): number {
  return baseMs * 2 ** attempt;
}

/** `attempt` is 0-indexed (0 = first try already made). True once every allowed retry has been used up. */
export function isPermanentFailure(attempt: number, maxAttempts: number): boolean {
  return attempt >= maxAttempts - 1;
}

/** Shared no-throw delay helper — resolves immediately for ms <= 0 rather than scheduling a zero-delay timer. */
export function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}
