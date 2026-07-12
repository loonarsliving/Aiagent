import { describe, expect, it } from "vitest";
import type { AIReport, WorkLogEntry } from "@mkh/shared";
import {
  buildMonthlySOPRecap,
  buildSOPComplianceData,
  buildWeeklySOPTrend,
  checkExcessiveRetry,
  checkMissedRun,
  checkRunFailed,
  checkStructuralStepMissing,
  evaluateModule,
  extractLatestRunSteps,
} from "./logic";
import type { SOPComplianceData } from "./types";

const NOW = new Date("2026-07-12T10:00:00.000Z");

function report(overrides: Partial<AIReport> = {}): AIReport {
  return {
    id: "rpt_x",
    moduleId: "finance-analyst",
    cadence: "daily",
    generatedAt: NOW.toISOString(),
    status: "success",
    summary: "test",
    data: {},
    ...overrides,
  };
}

function step(overrides: Partial<WorkLogEntry> = {}): WorkLogEntry {
  return {
    id: "wl_x",
    moduleId: "finance-analyst",
    runId: "run_1",
    cadence: "daily",
    step: "started",
    status: "info",
    loggedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("checkMissedRun", () => {
  it("flags a missed run when there is no report at all", () => {
    expect(checkMissedRun(null, NOW)).toBe(true);
  });

  it("flags a missed run when the latest report is from a previous company day", () => {
    expect(checkMissedRun(report({ generatedAt: "2026-07-10T10:00:00.000Z" }), NOW)).toBe(true);
  });

  it("does not flag a missed run when the latest report is from today", () => {
    expect(checkMissedRun(report({ generatedAt: NOW.toISOString() }), NOW)).toBe(false);
  });
});

describe("checkRunFailed", () => {
  it("flags a failed run", () => {
    expect(checkRunFailed(report({ status: "error" }))).toBe(true);
  });

  it("does not flag a successful run", () => {
    expect(checkRunFailed(report({ status: "success" }))).toBe(false);
  });
});

describe("checkExcessiveRetry", () => {
  it("flags a run that needed at least one retry", () => {
    expect(checkExcessiveRetry(report({ retryCount: 2 }))).toBe(true);
  });

  it("does not flag a run that succeeded on the first try", () => {
    expect(checkExcessiveRetry(report({ retryCount: 0 }))).toBe(false);
  });
});

describe("checkStructuralStepMissing", () => {
  it("does not flag when there is no work log at all (handled separately as missed_run)", () => {
    expect(checkStructuralStepMissing([])).toBe(false);
  });

  it("flags a run whose work log never reaches 'finished'", () => {
    expect(checkStructuralStepMissing([step({ step: "started" }), step({ step: "read_data" })])).toBe(true);
  });

  it("flags a run with too few distinct steps", () => {
    expect(checkStructuralStepMissing([step({ step: "finished" })])).toBe(true);
  });

  it("does not flag a complete run", () => {
    expect(checkStructuralStepMissing([step({ step: "started" }), step({ step: "finished" })])).toBe(false);
  });
});

describe("extractLatestRunSteps", () => {
  it("keeps only entries belonging to the most recent runId", () => {
    const entries = [step({ runId: "run_2", step: "finished" }), step({ runId: "run_2", step: "started" }), step({ runId: "run_1", step: "finished" })];
    const latest = extractLatestRunSteps(entries);
    expect(latest).toHaveLength(2);
    expect(latest.every((e) => e.runId === "run_2")).toBe(true);
  });

  it("returns an empty array when there are no entries", () => {
    expect(extractLatestRunSteps([])).toEqual([]);
  });
});

describe("evaluateModule", () => {
  it("returns only a missed_run violation when there is no fresh report, skipping downstream checks", () => {
    const violations = evaluateModule({ moduleId: "finance-analyst", latestReport: null, latestRunSteps: [] }, NOW);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.violationType).toBe("missed_run");
  });

  it("returns no violations for a compliant module", () => {
    const violations = evaluateModule(
      {
        moduleId: "finance-analyst",
        latestReport: report({ status: "success", retryCount: 0 }),
        latestRunSteps: [step({ step: "started" }), step({ step: "finished" })],
      },
      NOW,
    );
    expect(violations).toEqual([]);
  });

  it("can flag multiple simultaneous violations for a fresh but broken run", () => {
    const violations = evaluateModule(
      {
        moduleId: "finance-analyst",
        latestReport: report({ status: "error", retryCount: 2 }),
        latestRunSteps: [step({ step: "started" })],
      },
      NOW,
    );
    const types = violations.map((v) => v.violationType);
    expect(types).toContain("run_failed");
    expect(types).toContain("excessive_retry");
    expect(types).toContain("structural_step_missing");
  });
});

describe("buildSOPComplianceData", () => {
  it("separates compliant modules from violating ones", () => {
    const data = buildSOPComplianceData(
      "Hari ini",
      [
        { moduleId: "finance-analyst", latestReport: report({ moduleId: "finance-analyst" }), latestRunSteps: [step({ step: "started" }), step({ step: "finished" })] },
        { moduleId: "hr-officer", latestReport: null, latestRunSteps: [] },
      ],
      NOW,
    );
    expect(data.employeesChecked).toBe(2);
    expect(data.compliantModuleIds).toEqual(["finance-analyst"]);
    expect(data.violations.map((v) => v.moduleId)).toEqual(["hr-officer"]);
  });
});

function complianceReport(data: SOPComplianceData): AIReport<SOPComplianceData> {
  return {
    id: "rpt_x",
    moduleId: "sop-guardian",
    cadence: "daily",
    generatedAt: NOW.toISOString(),
    status: "success",
    summary: "test",
    data,
  };
}

describe("buildWeeklySOPTrend", () => {
  it("identifies modules that violated SOP on more than half the aggregated days as chronic", () => {
    const violation = { moduleId: "hr-officer" as const, violationType: "missed_run" as const, detail: "x", warning: "x" };
    const dailyReports = [
      complianceReport({ periodLabel: "d1", employeesChecked: 1, violations: [violation], compliantModuleIds: [] }),
      complianceReport({ periodLabel: "d2", employeesChecked: 1, violations: [violation], compliantModuleIds: [] }),
      complianceReport({ periodLabel: "d3", employeesChecked: 1, violations: [], compliantModuleIds: ["hr-officer"] }),
    ];
    const trend = buildWeeklySOPTrend("7 hari terakhir", dailyReports);
    expect(trend.chronicViolatorModuleIds).toContain("hr-officer");
  });

  it("handles no daily reports gracefully", () => {
    const trend = buildWeeklySOPTrend("7 hari terakhir", []);
    expect(trend.daysAggregated).toBe(0);
    expect(trend.avgViolationCount).toBe(0);
  });
});

describe("buildMonthlySOPRecap", () => {
  it("notes when there is nothing to recap", () => {
    const recap = buildMonthlySOPRecap("Bulan ini", []);
    expect(recap.daysAggregated).toBe(0);
    expect(recap.totalViolationIncidents).toBe(0);
  });

  it("sums violation incidents across the month", () => {
    const violation = { moduleId: "hr-officer" as const, violationType: "missed_run" as const, detail: "x", warning: "x" };
    const dailyReports = [complianceReport({ periodLabel: "d1", employeesChecked: 1, violations: [violation], compliantModuleIds: [] })];
    const recap = buildMonthlySOPRecap("Bulan ini", dailyReports);
    expect(recap.totalViolationIncidents).toBe(1);
  });
});
