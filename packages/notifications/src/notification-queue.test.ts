import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "@mkh/database";
import type { NotificationObject } from "@mkh/shared";
import { NOTIFICATION_JOB_TYPE, NotificationQueue } from "./notification-queue";

function notification(overrides: Partial<NotificationObject> = {}): NotificationObject {
  return {
    recipient: "owner",
    priority: "medium",
    title: "T",
    message: "M",
    reason: "R",
    suggestedAction: "A",
    escalation: null,
    channel: "dummy",
    approvalLevel: 1,
    sourceModuleId: "finance-analyst",
    createdAt: "2026-07-13T00:00:00.000Z",
    ...overrides,
  };
}

describe("NotificationQueue", () => {
  it("enqueue never sends anything — it only holds the NotificationObject in the job queue", async () => {
    const repo = new InMemoryRepository();
    const queue = new NotificationQueue(repo);

    const job = await queue.enqueue(notification());
    expect(job.type).toBe(NOTIFICATION_JOB_TYPE);
    expect(job.status).toBe("pending");
    expect(job.payload.channel).toBe("dummy"); // placeholder only, never a real adapter call
  });

  it("maps ReasoningPriority to the JobQueue's JobPriority", async () => {
    const repo = new InMemoryRepository();
    const queue = new NotificationQueue(repo);

    const urgent = await queue.enqueue(notification({ priority: "urgent" }));
    const high = await queue.enqueue(notification({ priority: "high" }));
    const medium = await queue.enqueue(notification({ priority: "medium" }));
    const low = await queue.enqueue(notification({ priority: "low" }));

    expect(urgent.priority).toBe("urgent");
    expect(high.priority).toBe("high");
    expect(medium.priority).toBe("normal");
    expect(low.priority).toBe("low");
  });

  it("claimNext only claims notification-dispatch jobs and returns the typed payload", async () => {
    const repo = new InMemoryRepository();
    const queue = new NotificationQueue(repo);
    await queue.enqueue(notification({ title: "Hello" }));

    const claimed = await queue.claimNext();
    expect(claimed?.status).toBe("running");
    expect(claimed?.payload.title).toBe("Hello");
  });

  it("claimNext returns null when the queue is empty", async () => {
    const repo = new InMemoryRepository();
    const queue = new NotificationQueue(repo);
    expect(await queue.claimNext()).toBeNull();
  });

  it("complete marks a claimed job success", async () => {
    const repo = new InMemoryRepository();
    const queue = new NotificationQueue(repo);
    await queue.enqueue(notification());
    const claimed = await queue.claimNext();
    const done = await queue.complete(claimed!.id);
    expect(done.status).toBe("success");
  });

  it("fail re-queues or dead-letters a claimed job", async () => {
    const repo = new InMemoryRepository();
    const queue = new NotificationQueue(repo);
    await queue.enqueue(notification(), { maxAttempts: 1 });
    const claimed = await queue.claimNext();
    const failed = await queue.fail(claimed!.id, "channel unavailable");
    expect(failed.status).toBe("dead");
  });

  it("listDeadLetters and countPending report queue health for monitoring", async () => {
    const repo = new InMemoryRepository();
    const queue = new NotificationQueue(repo);
    const toFail = await queue.enqueue(notification(), { maxAttempts: 1 });
    await queue.enqueue(notification());

    expect(await queue.countPending()).toBe(2);

    const claimed = await repo.getJob(toFail.id);
    await repo.updateJob(claimed!.id, { status: "running" });
    await queue.fail(toFail.id, "boom");

    expect(await queue.countPending()).toBe(1);
    const dead = await queue.listDeadLetters();
    expect(dead).toHaveLength(1);
  });
});
