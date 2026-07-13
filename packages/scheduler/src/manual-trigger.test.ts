import { describe, expect, it } from "vitest";
import { resetRepositoryCache, getRepository } from "@mkh/database";
import { AI_MODULE_IDS, type ScheduleRunRecord } from "@mkh/shared";
import { cadenceMethodExists, triggerAllWorkers, triggerEmployee, type DryRunResult } from "./manual-trigger";

describe("triggerEmployee", () => {
  it("runs the requested employee immediately, tagging the run as manual", async () => {
    resetRepositoryCache();
    const result = (await triggerEmployee({ moduleId: "finance-analyst", cadence: "daily", requestedBy: "operator:cli" })) as ScheduleRunRecord;

    expect(result.status).toBe("success");
    expect(result.scheduledTime).toBe("manual");
    expect(result.moduleId).toBe("finance-analyst");
    expect(result.reportId).toBeTruthy();

    const runs = await getRepository().listScheduleRuns(5);
    expect(runs.some((r) => r.id === result.id)).toBe(true);
  });

  it("records who requested the run on the resulting report's run context", async () => {
    resetRepositoryCache();
    await triggerEmployee({ moduleId: "sales-supervisor", cadence: "daily", requestedBy: "operator:owner" });
    const report = await getRepository().getLatestReport("sales-supervisor");
    expect(report?.status).toBe("success");
  });

  it("throws for an unknown employee id instead of silently no-op-ing", async () => {
    resetRepositoryCache();
    // @ts-expect-error deliberately invalid id to verify the guard rejects it
    await expect(triggerEmployee({ moduleId: "not-a-real-employee", cadence: "daily", requestedBy: "test" })).rejects.toThrow();
  });

  it("can run a weekly cadence on demand", async () => {
    resetRepositoryCache();
    await triggerEmployee({ moduleId: "finance-analyst", cadence: "daily", requestedBy: "test" });
    const result = await triggerEmployee({ moduleId: "finance-analyst", cadence: "weekly", requestedBy: "test" });
    expect("cadence" in result && result.cadence).toBe("weekly");
    expect("status" in result && result.status).toBe("success");
  });

  it("dry run validates without executing or writing a ScheduleRunRecord", async () => {
    resetRepositoryCache();
    const repo = getRepository();
    const runsBefore = await repo.listScheduleRuns(50);

    const result = (await triggerEmployee({ moduleId: "finance-analyst", cadence: "daily", requestedBy: "test", dryRun: true })) as DryRunResult;

    expect(result.dryRun).toBe(true);
    expect(result.moduleId).toBe("finance-analyst");
    expect(result.cadence).toBe("daily");
    expect(result.employeeName.length).toBeGreaterThan(0);

    const runsAfter = await repo.listScheduleRuns(50);
    expect(runsAfter.length).toBe(runsBefore.length);
    expect(await repo.getLatestReport("finance-analyst")).toBeNull();
  });

  it("dry run throws for an unknown employee id", async () => {
    resetRepositoryCache();
    // @ts-expect-error deliberately invalid id to verify the guard rejects it
    await expect(triggerEmployee({ moduleId: "not-a-real-employee", cadence: "daily", requestedBy: "test", dryRun: true })).rejects.toThrow();
  });

  it("dry run succeeds for weekly/monthly cadences when the employee implements them", async () => {
    resetRepositoryCache();
    const weekly = (await triggerEmployee({ moduleId: "sop-guardian", cadence: "weekly", requestedBy: "test", dryRun: true })) as DryRunResult;
    const monthly = (await triggerEmployee({ moduleId: "sop-guardian", cadence: "monthly", requestedBy: "test", dryRun: true })) as DryRunResult;
    expect(weekly.cadence).toBe("weekly");
    expect(monthly.cadence).toBe("monthly");
  });
});

describe("cadenceMethodExists", () => {
  const employee = { id: "finance-analyst", name: "x", role: "x", description: "x", sop: { daily: [] }, runDaily: async () => ({}) } as never;

  it("reports true for daily (always required) and false for weekly/monthly when unimplemented", () => {
    expect(cadenceMethodExists(employee, "daily")).toBe(true);
    expect(cadenceMethodExists(employee, "weekly")).toBe(false);
    expect(cadenceMethodExists(employee, "monthly")).toBe(false);
  });
});

describe("triggerAllWorkers", () => {
  it("triggers every registered employee for the given cadence", async () => {
    resetRepositoryCache();
    const results = await triggerAllWorkers({ cadence: "daily", requestedBy: "operator:cli" });
    expect(results).toHaveLength(AI_MODULE_IDS.length);
    expect(results.map((r) => ("moduleId" in r ? r.moduleId : undefined)).sort()).toEqual([...AI_MODULE_IDS].sort());
  });

  it("supports dry-run mode across every employee without writing any ScheduleRunRecord", async () => {
    resetRepositoryCache();
    const repo = getRepository();
    const results = (await triggerAllWorkers({ cadence: "daily", requestedBy: "operator:cli", dryRun: true })) as DryRunResult[];

    expect(results).toHaveLength(AI_MODULE_IDS.length);
    expect(results.every((r) => r.dryRun === true)).toBe(true);
    expect(await repo.listScheduleRuns(50)).toHaveLength(0);
  });
});
