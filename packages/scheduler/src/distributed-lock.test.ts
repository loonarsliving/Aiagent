import { describe, expect, it, vi } from "vitest";
import { resetRepositoryCache, getRepository } from "@mkh/database";
import { LockNotAcquiredError, withDistributedLock } from "./distributed-lock";

describe("withDistributedLock", () => {
  it("acquires the lock, runs fn, and releases the lock afterward", async () => {
    resetRepositoryCache();
    const repo = getRepository();

    const result = await withDistributedLock("scheduler:finance-analyst:daily", async () => "done", { holderId: "holder-1" });

    expect(result).toBe("done");
    expect(await repo.getLock("scheduler:finance-analyst:daily")).toBeNull();
  });

  it("releases the lock even when fn throws", async () => {
    resetRepositoryCache();
    const repo = getRepository();

    await expect(
      withDistributedLock(
        "scheduler:finance-analyst:daily",
        async () => {
          throw new Error("boom");
        },
        { holderId: "holder-1" },
      ),
    ).rejects.toThrow("boom");

    expect(await repo.getLock("scheduler:finance-analyst:daily")).toBeNull();
  });

  it("throws LockNotAcquiredError without calling fn when another holder already has a live lock", async () => {
    resetRepositoryCache();
    const repo = getRepository();
    const future = new Date(Date.now() + 60_000).toISOString();
    await repo.acquireLock("scheduler:finance-analyst:daily", "other-holder", future);

    const fn = vi.fn(async () => "should not run");
    await expect(withDistributedLock("scheduler:finance-analyst:daily", fn, { holderId: "holder-1" })).rejects.toThrow(LockNotAcquiredError);
    expect(fn).not.toHaveBeenCalled();
  });

  it("reclaims an expired lock left behind by a crashed holder", async () => {
    resetRepositoryCache();
    const repo = getRepository();
    const expired = new Date(Date.now() - 60_000).toISOString();
    await repo.acquireLock("scheduler:finance-analyst:daily", "crashed-holder", expired);

    const result = await withDistributedLock("scheduler:finance-analyst:daily", async () => "recovered", { holderId: "holder-1" });
    expect(result).toBe("recovered");
  });

  it("defaults the TTL from config.SCHEDULER_LOCK_TTL_MS when not overridden", async () => {
    resetRepositoryCache();
    const repo = getRepository();
    const acquireSpy = vi.spyOn(repo, "acquireLock");

    await withDistributedLock("scheduler:finance-analyst:daily", async () => "ok", { holderId: "holder-1" });

    const [, , expiresAt] = acquireSpy.mock.calls[0]!;
    const ttlMs = new Date(expiresAt).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(250_000); // default 300_000 minus test execution slack
    expect(ttlMs).toBeLessThanOrEqual(300_000);
  });
});
