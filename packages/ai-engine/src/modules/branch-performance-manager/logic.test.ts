import { describe, expect, it } from "vitest";
import type { SalesRepProgress } from "@mkh/database";
import type { AIReport } from "@mkh/shared";
import {
  buildBranchPerformance,
  buildBranchPerformanceData,
  buildMonthlyBranchRecap,
  buildRecommendation,
  buildWeeklyBranchTrend,
  classifyBranch,
  groupByBranch,
} from "./logic";
import type { BranchPerformanceData } from "./types";

function rep(overrides: Partial<SalesRepProgress> = {}): SalesRepProgress {
  return {
    repId: "rep_test",
    name: "Test Rep",
    branch: "Kendari",
    targetIdr: 100_000_000,
    achievedIdr: 50_000_000,
    lastActivityDaysAgo: 1,
    ...overrides,
  };
}

describe("groupByBranch", () => {
  it("groups reps by whatever branch names exist in the data, no hardcoded list", () => {
    const groups = groupByBranch([
      rep({ repId: "a", branch: "Kendari" }),
      rep({ repId: "b", branch: "Kendari" }),
      rep({ repId: "c", branch: "Baubau" }),
    ]);
    expect(Array.from(groups.keys()).sort()).toEqual(["Baubau", "Kendari"]);
    expect(groups.get("Kendari")).toHaveLength(2);
    expect(groups.get("Baubau")).toHaveLength(1);
  });

  it("produces a new group automatically for a previously unseen branch", () => {
    const groups = groupByBranch([rep({ branch: "Cabang Baru" })]);
    expect(groups.has("Cabang Baru")).toBe(true);
  });
});

describe("classifyBranch", () => {
  it("marks a branch critical when progress is far below threshold", () => {
    expect(classifyBranch(30, 0)).toBe("critical");
  });

  it("marks a branch needs_attention when progress is mid-range or activity is stale", () => {
    expect(classifyBranch(60, 0)).toBe("needs_attention");
    expect(classifyBranch(90, 5)).toBe("needs_attention");
  });

  it("marks a branch healthy when progress is high and activity is fresh", () => {
    expect(classifyBranch(90, 0)).toBe("healthy");
  });
});

describe("buildRecommendation", () => {
  it("addresses the recommendation to the Kepala Cabang of that specific branch", () => {
    const text = buildRecommendation("Kendari", "critical", 30, 3);
    expect(text).toContain("Kepala Cabang Kendari");
  });
});

describe("buildBranchPerformance", () => {
  it("aggregates target/achieved across reps in the branch and attaches a status + recommendation", () => {
    const perf = buildBranchPerformance("Kendari", [
      rep({ repId: "a", targetIdr: 100_000_000, achievedIdr: 90_000_000, lastActivityDaysAgo: 0 }),
      rep({ repId: "b", targetIdr: 100_000_000, achievedIdr: 90_000_000, lastActivityDaysAgo: 0 }),
    ]);
    expect(perf.totalTargetIdr).toBe(200_000_000);
    expect(perf.totalAchievedIdr).toBe(180_000_000);
    expect(perf.progressPct).toBe(90);
    expect(perf.repCount).toBe(2);
    expect(perf.status).toBe("healthy");
    expect(perf.recommendation).toBeTruthy();
  });
});

describe("buildBranchPerformanceData", () => {
  it("lists branches sorted by ascending progress and flags those needing attention", () => {
    const data = buildBranchPerformanceData("Juli 2026", [
      rep({ repId: "a", branch: "Kendari", targetIdr: 100_000_000, achievedIdr: 90_000_000, lastActivityDaysAgo: 0 }),
      rep({ repId: "b", branch: "Baubau", targetIdr: 100_000_000, achievedIdr: 20_000_000, lastActivityDaysAgo: 0 }),
    ]);
    expect(data.branches.map((b) => b.branch)).toEqual(["Baubau", "Kendari"]);
    expect(data.branchesNeedingAttention).toEqual(["Baubau"]);
  });
});

describe("buildWeeklyBranchTrend", () => {
  function report(branches: BranchPerformanceData["branches"]): AIReport<BranchPerformanceData> {
    return {
      id: "rpt_x",
      moduleId: "branch-performance-manager",
      cadence: "daily",
      generatedAt: new Date().toISOString(),
      status: "success",
      summary: "test",
      data: { periodLabel: "test", branches, branchesNeedingAttention: [] },
    };
  }

  it("detects an improving trend per branch across the week", () => {
    const perf = (progressPct: number) => buildBranchPerformance("Kendari", [rep({ targetIdr: 100, achievedIdr: progressPct })]);
    const dailyReports = [report([perf(40)]), report([perf(80)])];
    const trend = buildWeeklyBranchTrend("7 hari terakhir", dailyReports);
    expect(trend.branchTrends[0]?.branch).toBe("Kendari");
    expect(trend.branchTrends[0]?.trend).toBe("improving");
  });

  it("handles no daily reports gracefully", () => {
    const trend = buildWeeklyBranchTrend("7 hari terakhir", []);
    expect(trend.daysAggregated).toBe(0);
    expect(trend.branchTrends).toEqual([]);
  });
});

describe("buildMonthlyBranchRecap", () => {
  it("summarizes the final day's branch progress", () => {
    const dailyReports: AIReport<BranchPerformanceData>[] = [
      {
        id: "rpt_x",
        moduleId: "branch-performance-manager",
        cadence: "daily",
        generatedAt: new Date().toISOString(),
        status: "success",
        summary: "test",
        data: {
          periodLabel: "test",
          branches: [buildBranchPerformance("Kendari", [rep({ targetIdr: 100, achievedIdr: 80 })])],
          branchesNeedingAttention: [],
        },
      },
    ];
    const recap = buildMonthlyBranchRecap("Bulan ini", dailyReports);
    expect(recap.branchSummaries).toHaveLength(1);
    expect(recap.branchSummaries[0]?.branch).toBe("Kendari");
  });

  it("notes when there is nothing to recap", () => {
    const recap = buildMonthlyBranchRecap("Bulan ini", []);
    expect(recap.daysAggregated).toBe(0);
    expect(recap.branchSummaries).toEqual([]);
  });
});
