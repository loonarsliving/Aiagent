import { describe, expect, it } from "vitest";
import { resetRepositoryCache, getRepository } from "@mkh/database";
import type { ScheduleEntry } from "@mkh/shared";
import { runScheduledTask } from "./executor";

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
});
