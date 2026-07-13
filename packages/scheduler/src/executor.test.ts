import { describe, expect, it } from "vitest";
import { resetRepositoryCache, getRepository } from "@mkh/database";
import type { ScheduleEntry } from "@mkh/shared";
import { runScheduledTask } from "./executor";
import { withDistributedLock } from "./distributed-lock";

function entry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: "sch_test",
    moduleId: "marketing-intelligence",
    cadence: "daily",
    time: "06:00",
    label: "test",
    enabled: true,
    ...overrides,
  };
}

describe("runScheduledTask", () => {
  it("runs the employee's task for the given cadence, records a schedule run, and links the resulting report", async () => {
    resetRepositoryCache();
    const result = await runScheduledTask(entry());

    expect(result.status).toBe("success");
    expect(result.cadence).toBe("daily");
    expect(result.reportId).toBeTruthy();
    expect(result.finishedAt).toBeTruthy();

    const runs = await getRepository().listScheduleRuns(5);
    expect(runs.some((r) => r.id === result.id)).toBe(true);
  });

  it("resolves any registered employee id and respects the requested cadence", async () => {
    resetRepositoryCache();
    const result = await runScheduledTask(entry({ moduleId: "finance-analyst", cadence: "daily", time: "15:00" }));
    expect(result.status).toBe("success");
    expect(result.moduleId).toBe("finance-analyst");
  });

  it("runs a weekly task when the entry's cadence is weekly", async () => {
    resetRepositoryCache();
    // Prime a daily report first so weekly aggregation (aggregateRecentReports) has something to read.
    await runScheduledTask(entry({ moduleId: "sales-supervisor", cadence: "daily", time: "12:00" }));
    const result = await runScheduledTask(entry({ moduleId: "sales-supervisor", cadence: "weekly", time: "12:30", dayOfWeek: 1 }));

    expect(result.cadence).toBe("weekly");
    expect(result.status).toBe("success");
  });

  it("records a skipped run instead of executing the employee when another process already holds the slot's lock", async () => {
    resetRepositoryCache();
    const repo = getRepository();
    const future = new Date(Date.now() + 60_000).toISOString();
    await repo.acquireLock("scheduler:finance-analyst:daily", "other-process", future);

    const reportsBefore = await repo.listReports("finance-analyst");
    const result = await runScheduledTask(entry({ moduleId: "finance-analyst", cadence: "daily", time: "15:00" }));

    expect(result.status).toBe("skipped");
    expect(result.reportId).toBeUndefined();
    const reportsAfter = await repo.listReports("finance-analyst");
    expect(reportsAfter.length).toBe(reportsBefore.length); // no employee task ran
  });

  it("releases the lock after a run so the next scheduled slot for the same employee+cadence can proceed", async () => {
    resetRepositoryCache();
    const repo = getRepository();
    await runScheduledTask(entry({ moduleId: "finance-analyst", cadence: "daily", time: "15:00" }));
    expect(await repo.getLock("scheduler:finance-analyst:daily")).toBeNull();
  });
});

describe("runScheduledTask — lock key scoping", () => {
  it("uses independent lock keys per moduleId+cadence so unrelated slots never contend", async () => {
    resetRepositoryCache();
    const results = await Promise.all([
      withDistributedLock("scheduler:finance-analyst:daily", async () => "a", { holderId: "h1" }),
      withDistributedLock("scheduler:finance-analyst:weekly", async () => "b", { holderId: "h2" }),
      withDistributedLock("scheduler:sales-supervisor:daily", async () => "c", { holderId: "h3" }),
    ]);
    expect(results).toEqual(["a", "b", "c"]);
  });
});
