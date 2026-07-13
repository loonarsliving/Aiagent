import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "@mkh/database";
import { AI_MODULE_IDS } from "@mkh/shared";
import { JobQueue } from "@mkh/queue";
import { NotificationQueue } from "@mkh/notifications";
import { getMonitoringSnapshot } from "./snapshot";

function report(overrides: Record<string, unknown> = {}) {
  return {
    id: "rpt_1",
    moduleId: "finance-analyst" as const,
    cadence: "daily" as const,
    generatedAt: "2026-07-13T00:00:00.000Z",
    status: "success" as const,
    summary: "ok",
    data: {},
    ...overrides,
  };
}

describe("getMonitoringSnapshot", () => {
  it("reports one WorkerStatus per registered employee, null for those with no report yet", async () => {
    const repo = new InMemoryRepository();
    await repo.saveReport(report());

    const snapshot = await getMonitoringSnapshot(repo);
    expect(snapshot.workers).toHaveLength(AI_MODULE_IDS.length);

    const finance = snapshot.workers.find((w) => w.moduleId === "finance-analyst");
    expect(finance?.lastStatus).toBe("success");
    expect(finance?.lastRunAt).toBe("2026-07-13T00:00:00.000Z");

    const other = snapshot.workers.find((w) => w.moduleId === "hr-officer");
    expect(other?.lastStatus).toBeNull();
    expect(other?.lastRunAt).toBeNull();
  });

  it("aggregates queue health across every job type, separately from the notification queue", async () => {
    const repo = new InMemoryRepository();
    const queue = new JobQueue(repo);
    const notificationQueue = new NotificationQueue(repo);

    await queue.enqueue("some-other-job", {});
    await notificationQueue.enqueue({
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
    });

    const snapshot = await getMonitoringSnapshot(repo);
    expect(snapshot.queue.pending).toBe(2); // both job types counted together
    expect(snapshot.notificationQueue.pending).toBe(1); // scoped to notification-dispatch only
  });

  it("counts pending jobs with attempts > 0 as retrying", async () => {
    const repo = new InMemoryRepository();
    const queue = new JobQueue(repo);
    const job = await queue.enqueue("some-job", {}, { maxAttempts: 5 });
    await queue.fail(job.id, "transient");

    const snapshot = await getMonitoringSnapshot(repo);
    expect(snapshot.queue.retrying).toBe(1);
  });

  it("reports a null scheduler heartbeat when nothing has ever run", async () => {
    const repo = new InMemoryRepository();
    const snapshot = await getMonitoringSnapshot(repo);
    expect(snapshot.scheduler.lastRunAt).toBeNull();
    expect(snapshot.scheduler.msSinceLastRun).toBeNull();
  });

  it("reports the most recent scheduler run as the heartbeat", async () => {
    const repo = new InMemoryRepository();
    await repo.saveScheduleRun({
      id: "run_1",
      moduleId: "finance-analyst",
      cadence: "daily",
      scheduledTime: "15:00",
      startedAt: new Date().toISOString(),
      status: "success",
    });

    const snapshot = await getMonitoringSnapshot(repo);
    expect(snapshot.scheduler.lastRunStatus).toBe("success");
    expect(snapshot.scheduler.msSinceLastRun).toBeGreaterThanOrEqual(0);
  });

  it("aggregates today's reasoning stats (execution count, average response time, total tokens) and excludes older entries", async () => {
    const repo = new InMemoryRepository();
    await repo.saveAIReasoningLog({
      id: "log_today_1",
      moduleId: "finance-analyst",
      runId: "run_1",
      provider: "gemini",
      model: "gemini-2.0-flash",
      status: "success",
      responseTimeMs: 100,
      totalTokens: 50,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    });
    await repo.saveAIReasoningLog({
      id: "log_today_2",
      moduleId: "hr-officer",
      runId: "run_2",
      provider: "gemini",
      model: "gemini-2.0-flash",
      status: "success",
      responseTimeMs: 300,
      totalTokens: 150,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    });
    await repo.saveAIReasoningLog({
      id: "log_old",
      moduleId: "finance-analyst",
      runId: "run_3",
      provider: "gemini",
      model: "gemini-2.0-flash",
      status: "success",
      responseTimeMs: 999,
      totalTokens: 999,
      retryCount: 0,
      createdAt: "2020-01-01T00:00:00.000Z",
    });

    const snapshot = await getMonitoringSnapshot(repo);
    expect(snapshot.reasoning.executionsToday).toBe(2);
    expect(snapshot.reasoning.averageResponseTimeMs).toBe(200);
    expect(snapshot.reasoning.totalTokensToday).toBe(200);
  });

  it("includes real process memory usage figures", async () => {
    const repo = new InMemoryRepository();
    const snapshot = await getMonitoringSnapshot(repo);
    expect(snapshot.memoryUsage.rss).toBeGreaterThan(0);
    expect(snapshot.memoryUsage.heapUsed).toBeGreaterThan(0);
  });
});
