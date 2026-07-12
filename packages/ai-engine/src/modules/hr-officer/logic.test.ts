import { describe, expect, it } from "vitest";
import type { StaffAttendanceRecord } from "@mkh/database";
import type { AIReport } from "@mkh/shared";
import {
  buildHRAnalysis,
  buildMonthlyHRRecap,
  buildWeeklyHRTrend,
  coachingRecommendationFor,
  computeAttendanceRatePct,
  detectIssues,
  evaluateStaff,
} from "./logic";
import type { HRAnalysisData } from "./types";

function staff(overrides: Partial<StaffAttendanceRecord> = {}): StaffAttendanceRecord {
  return {
    staffId: "stf_test",
    name: "Test Staff",
    branch: "Kendari",
    role: "Sales",
    presentDays: 22,
    lateDays: 0,
    leaveDaysTaken: 1,
    leaveDaysQuota: 12,
    kpiScore: 90,
    ...overrides,
  };
}

describe("computeAttendanceRatePct", () => {
  it("computes present days as a percentage of working days", () => {
    expect(computeAttendanceRatePct(staff({ presentDays: 18 }), 22)).toBeCloseTo(81.8, 1);
  });
});

describe("detectIssues", () => {
  it("flags chronic lateness", () => {
    expect(detectIssues(staff({ lateDays: 5 }), 90)).toContain("keterlambatan");
  });

  it("flags low attendance", () => {
    expect(detectIssues(staff(), 60)).toContain("kehadiran_rendah");
  });

  it("flags leave over quota", () => {
    expect(detectIssues(staff({ leaveDaysTaken: 15, leaveDaysQuota: 12 }), 90)).toContain("cuti_melebihi_kuota");
  });

  it("flags low KPI", () => {
    expect(detectIssues(staff({ kpiScore: 40 }), 90)).toContain("kpi_rendah");
  });

  it("flags nothing for a healthy staff member", () => {
    expect(detectIssues(staff(), 100)).toEqual([]);
  });
});

describe("coachingRecommendationFor", () => {
  it("mentions the staff name and a coaching action", () => {
    const text = coachingRecommendationFor(staff({ name: "Fajar" }), ["keterlambatan"]);
    expect(text).toContain("Fajar");
    expect(text).toContain("coaching");
  });
});

describe("evaluateStaff", () => {
  it("returns null when there are no issues", () => {
    expect(evaluateStaff(staff({ presentDays: 22, lateDays: 0, kpiScore: 95 }), 22)).toBeNull();
  });

  it("returns a flag with a coaching recommendation when there are issues", () => {
    const flag = evaluateStaff(staff({ lateDays: 6, presentDays: 14, kpiScore: 40 }), 22);
    expect(flag).not.toBeNull();
    expect(flag?.issues.length).toBeGreaterThan(0);
    expect(flag?.coachingRecommendation).toBeTruthy();
  });
});

describe("buildHRAnalysis", () => {
  it("aggregates avg KPI and collects flagged staff", () => {
    const data = buildHRAnalysis("Juli 2026", 22, [
      staff({ staffId: "a", kpiScore: 95, presentDays: 22, lateDays: 0 }),
      staff({ staffId: "b", kpiScore: 40, presentDays: 14, lateDays: 6 }),
    ]);
    expect(data.totalStaff).toBe(2);
    expect(data.avgKpiScore).toBeCloseTo(67.5, 1);
    expect(data.flaggedStaff).toHaveLength(1);
    expect(data.flaggedStaff[0]?.staffId).toBe("b");
  });
});

function report(data: HRAnalysisData): AIReport<HRAnalysisData> {
  return {
    id: "rpt_x",
    moduleId: "hr-officer",
    cadence: "daily",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: "test",
    data,
  };
}

describe("buildWeeklyHRTrend", () => {
  it("identifies staff flagged on more than half of the aggregated days as chronic", () => {
    const flag = evaluateStaff(staff({ staffId: "b", name: "Budi", lateDays: 6, presentDays: 14, kpiScore: 40 }), 22)!;
    const dailyReports = [
      report({ periodLabel: "d1", totalStaff: 1, avgKpiScore: 40, flaggedStaff: [flag] }),
      report({ periodLabel: "d2", totalStaff: 1, avgKpiScore: 40, flaggedStaff: [flag] }),
      report({ periodLabel: "d3", totalStaff: 1, avgKpiScore: 90, flaggedStaff: [] }),
    ];
    const trend = buildWeeklyHRTrend("7 hari terakhir", dailyReports);
    expect(trend.chronicIssueStaff).toContain("Budi");
  });

  it("handles no daily reports gracefully", () => {
    const trend = buildWeeklyHRTrend("7 hari terakhir", []);
    expect(trend.daysAggregated).toBe(0);
    expect(trend.avgFlaggedCount).toBe(0);
  });
});

describe("buildMonthlyHRRecap", () => {
  it("notes when there is nothing to recap", () => {
    const recap = buildMonthlyHRRecap("Bulan ini", []);
    expect(recap.daysAggregated).toBe(0);
    expect(recap.totalFlagIncidents).toBe(0);
  });

  it("summarizes final KPI and total flag incidents", () => {
    const flag = evaluateStaff(staff({ staffId: "b", lateDays: 6, presentDays: 14, kpiScore: 40 }), 22)!;
    const dailyReports = [report({ periodLabel: "d1", totalStaff: 1, avgKpiScore: 55, flaggedStaff: [flag] })];
    const recap = buildMonthlyHRRecap("Bulan ini", dailyReports);
    expect(recap.finalAvgKpiScore).toBe(55);
    expect(recap.totalFlagIncidents).toBe(1);
  });
});
