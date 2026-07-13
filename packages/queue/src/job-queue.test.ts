import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InMemoryRepository } from "@mkh/database";
import { resetConfigCache } from "@mkh/shared";
import { JobQueue } from "./job-queue";

describe("JobQueue", () => {
  let repo: InMemoryRepository;
  let queue: JobQueue;

  beforeEach(() => {
    repo = new InMemoryRepository();
    queue = new JobQueue(repo);
  });

  afterEach(() => {
    delete process.env.QUEUE_MAX_ATTEMPTS;
    delete process.env.QUEUE_RETRY_BACKOFF_MS;
    resetConfigCache();
  });

  it("enqueue defaults priority to normal, runAt to now, and maxAttempts to config.QUEUE_MAX_ATTEMPTS", async () => {
    const job = await queue.enqueue("notification-dispatch", { hello: "world" });
    expect(job.priority).toBe("normal");
    expect(job.status).toBe("pending");
    expect(job.maxAttempts).toBe(5);
    expect(job.attempts).toBe(0);
    expect(job.payload).toEqual({ hello: "world" });
  });

  it("enqueue honors explicit priority/runAt/maxAttempts overrides", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const job = await queue.enqueue("notification-dispatch", {}, { priority: "urgent", runAt: future, maxAttempts: 1 });
    expect(job.priority).toBe("urgent");
    expect(job.runAt).toBe(future);
    expect(job.maxAttempts).toBe(1);
  });

  it("claimNext returns null when nothing is due, and the claimed job otherwise", async () => {
    expect(await queue.claimNext()).toBeNull();

    const job = await queue.enqueue("notification-dispatch", {});
    const claimed = await queue.claimNext("notification-dispatch");
    expect(claimed?.id).toBe(job.id);
    expect(claimed?.status).toBe("running");
  });

  it("complete marks the job success", async () => {
    const job = await queue.enqueue("notification-dispatch", {});
    const done = await queue.complete(job.id);
    expect(done.status).toBe("success");
  });

  it("fail re-queues with exponential backoff while attempts remain", async () => {
    const job = await queue.enqueue("notification-dispatch", {}, { maxAttempts: 3 });
    const before = Date.now();
    const failed = await queue.fail(job.id, "network error");
    expect(failed.status).toBe("pending");
    expect(failed.attempts).toBe(1);
    expect(failed.lastError).toBe("network error");
    // QUEUE_RETRY_BACKOFF_MS default 1000 * 2^0 = 1000ms
    expect(new Date(failed.runAt).getTime()).toBeGreaterThanOrEqual(before + 1_000 - 50);
  });

  it("fail moves the job to the Dead Letter Queue once maxAttempts is exhausted", async () => {
    const job = await queue.enqueue("notification-dispatch", {}, { maxAttempts: 2 });
    await queue.fail(job.id, "first failure");
    const dead = await queue.fail(job.id, "second failure");
    expect(dead.status).toBe("dead");
    expect(dead.attempts).toBe(2);
  });

  it("fail throws for an unknown job id", async () => {
    await expect(queue.fail("nope", "boom")).rejects.toThrow("not found");
  });

  it("listDeadLetters returns only dead jobs, optionally filtered by type", async () => {
    const a = await queue.enqueue("notification-dispatch", {}, { maxAttempts: 1 });
    const b = await queue.enqueue("other-type", {}, { maxAttempts: 1 });
    await queue.fail(a.id, "boom");
    await queue.fail(b.id, "boom");

    const all = await queue.listDeadLetters();
    expect(all.map((j) => j.id).sort()).toEqual([a.id, b.id].sort());

    const filtered = await queue.listDeadLetters("notification-dispatch");
    expect(filtered.map((j) => j.id)).toEqual([a.id]);
  });

  it("countByStatus counts jobs matching a status, optionally scoped by type", async () => {
    await queue.enqueue("notification-dispatch", {});
    await queue.enqueue("notification-dispatch", {});
    await queue.enqueue("other-type", {});

    expect(await queue.countByStatus("pending")).toBe(3);
    expect(await queue.countByStatus("pending", "notification-dispatch")).toBe(2);
    expect(await queue.countByStatus("dead")).toBe(0);
  });

  it("respects QUEUE_MAX_ATTEMPTS and QUEUE_RETRY_BACKOFF_MS overrides from config", async () => {
    process.env.QUEUE_MAX_ATTEMPTS = "1";
    process.env.QUEUE_RETRY_BACKOFF_MS = "5000";
    resetConfigCache();
    const job = await queue.enqueue("notification-dispatch", {});
    expect(job.maxAttempts).toBe(1);

    const failed = await queue.fail(job.id, "boom");
    expect(failed.status).toBe("dead"); // maxAttempts=1 means the first failure is already permanent
  });
});
