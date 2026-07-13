import { describe, expect, it } from "vitest";
import { computeBackoffMs, isPermanentFailure, sleep } from "./retry-policy";

describe("computeBackoffMs", () => {
  it("doubles per attempt starting from baseMs", () => {
    expect(computeBackoffMs(100, 0)).toBe(100);
    expect(computeBackoffMs(100, 1)).toBe(200);
    expect(computeBackoffMs(100, 2)).toBe(400);
    expect(computeBackoffMs(100, 3)).toBe(800);
  });

  it("returns 0 when baseMs is 0 regardless of attempt", () => {
    expect(computeBackoffMs(0, 5)).toBe(0);
  });
});

describe("isPermanentFailure", () => {
  it("is false while attempts remain", () => {
    expect(isPermanentFailure(0, 3)).toBe(false);
    expect(isPermanentFailure(1, 3)).toBe(false);
  });

  it("is true on the last allowed attempt", () => {
    expect(isPermanentFailure(2, 3)).toBe(true);
  });

  it("is true once attempts meet or exceed maxAttempts", () => {
    expect(isPermanentFailure(3, 3)).toBe(true);
    expect(isPermanentFailure(10, 3)).toBe(true);
  });
});

describe("sleep", () => {
  it("resolves immediately for ms <= 0", async () => {
    const start = Date.now();
    await sleep(0);
    expect(Date.now() - start).toBeLessThan(20);
  });

  it("resolves after roughly the requested delay", async () => {
    const start = Date.now();
    await sleep(15);
    expect(Date.now() - start).toBeGreaterThanOrEqual(10);
  });
});
