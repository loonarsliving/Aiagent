import { describe, expect, it } from "vitest";
import type { FinanceTransaction } from "@mkh/database";
import type { AIReport } from "@mkh/shared";
import type { FinanceAnalysisData } from "../finance-analyst/types";
import type { DailyResearchSummary } from "../marketing-intelligence/types";
import type { OperationsPlan } from "../marketing-operation/types";
import type { MetaAdsAnalysisData } from "../meta-ads-operator/types";
import type { SalesSupervisionData } from "../sales-supervisor/types";
import {
  buildAttentionNeeded,
  buildExecutiveSummary,
  buildMonthlyBoardReport,
  buildPropertyBreakdown,
  buildRecommendations,
  buildTomorrowPriorities,
  buildWeeklyExecutiveRollup,
} from "./logic";
import type { ExecutiveSummaryData } from "./types";

function metaAds(overrides: Partial<MetaAdsAnalysisData> = {}): MetaAdsAnalysisData {
  return { campaigns: [], recommendations: [], proposedApprovalIds: [], ...overrides };
}

function sales(overrides: Partial<SalesSupervisionData> = {}): SalesSupervisionData {
  return { periodLabel: "x", overallProgressPct: 70, reps: [], laggingReps: [], ...overrides };
}

function finance(overrides: Partial<FinanceAnalysisData> = {}): FinanceAnalysisData {
  return { periodLabel: "x", totalIncomeIdr: 0, totalExpenseIdr: 0, netCashflowIdr: 0, cashflowProjectionNext7dIdr: 0, anomalies: [], ...overrides };
}

function marketingOp(overrides: Partial<OperationsPlan> = {}): OperationsPlan {
  return { weeklyChecklist: [], incompleteCount: 0, remindersSent: 0, prioritySummary: "semua aman", ...overrides };
}

function marketingIntel(overrides: Partial<DailyResearchSummary> = {}): DailyResearchSummary {
  return { newSignals: 0, recurringSignals: 0, totalKnowledgeItems: 0, topOpportunities: [], dailyRecommendation: "", contentChecklist: [], ...overrides };
}

describe("buildAttentionNeeded", () => {
  it("collects actionable items from meta ads, lagging sales, finance anomalies, and incomplete checklist", () => {
    const items = buildAttentionNeeded(
      metaAds({ recommendations: [{ campaignId: "c1", campaignName: "Camp A", action: "pause_campaign", reason: "no leads", proposedChange: {} }] }),
      sales({ laggingReps: [{ repId: "r1", name: "Budi", branch: "Makassar", targetIdr: 1, achievedIdr: 0, progressPct: 10, status: "lagging", lastActivityDaysAgo: 9 }] }),
      finance({ anomalies: [{ transactionId: "t1", category: "Operasional", amountIdr: 1, description: "x", reasonFlagged: "outlier" }] }),
      marketingOp({ incompleteCount: 2 }),
    );

    expect(items).toHaveLength(4);
    expect(items[0]).toContain("Meta Ads");
    expect(items[1]).toContain("Budi");
    expect(items[2]).toContain("Finance");
    expect(items[3]).toContain("Marketing");
  });

  it("returns an empty list when everything is healthy", () => {
    expect(buildAttentionNeeded(metaAds(), sales({ laggingReps: [] }), finance({ anomalies: [] }), marketingOp({ incompleteCount: 0 }))).toHaveLength(0);
  });
});

describe("buildRecommendations", () => {
  it("surfaces marketing recommendation, meta ads approvals pending, and sales follow-up", () => {
    const recs = buildRecommendations(
      marketingIntel({ dailyRecommendation: "Fokus konten X" }),
      metaAds({ recommendations: [{ campaignId: "c1", campaignName: "A", action: "increase_budget", reason: "efisien", proposedChange: {} }] }),
      sales({ laggingReps: [{ repId: "r1", name: "Budi", branch: "Makassar", targetIdr: 1, achievedIdr: 0, progressPct: 10, status: "lagging", lastActivityDaysAgo: 9 }] }),
    );
    expect(recs).toContain("Fokus konten X");
    expect(recs.some((r) => r.includes("Approval Request"))).toBe(true);
    expect(recs.some((r) => r.includes("follow up"))).toBe(true);
  });
});

describe("buildTomorrowPriorities", () => {
  it("takes the top attention items plus the strongest content opportunity", () => {
    const priorities = buildTomorrowPriorities(["Meta Ads: A", "Sales: B", "Finance: C", "Marketing: D"], marketingIntel({ topOpportunities: ["Tema Utama"] }));
    expect(priorities).toHaveLength(4); // top 3 attention + 1 content opportunity
    expect(priorities.at(-1)).toContain("Tema Utama");
  });

  it("falls back to a routine-ops message when nothing needs attention", () => {
    const priorities = buildTomorrowPriorities([], marketingIntel({ topOpportunities: [] }));
    expect(priorities[0]).toContain("operasional rutin");
  });
});

describe("buildPropertyBreakdown", () => {
  it("sums income by Villa vs Perumahan category only", () => {
    const transactions: FinanceTransaction[] = [
      { id: "t1", date: "2026-07-01", type: "income", category: "Penjualan Villa", amountIdr: 100, description: "" },
      { id: "t2", date: "2026-07-02", type: "income", category: "Penjualan Perumahan", amountIdr: 50, description: "" },
      { id: "t3", date: "2026-07-03", type: "expense", category: "Penjualan Villa", amountIdr: 999, description: "" }, // excluded: not income
    ];
    const breakdown = buildPropertyBreakdown(transactions);
    expect(breakdown.villaIncomeIdr).toBe(100);
    expect(breakdown.perumahanIncomeIdr).toBe(50);
  });
});

describe("buildExecutiveSummary", () => {
  it("assembles all sections into one summary", () => {
    const data = buildExecutiveSummary("hari ini", marketingIntel(), marketingOp(), metaAds(), sales(), finance(), []);
    expect(data.periodLabel).toBe("hari ini");
    expect(data.sales.overallProgressPct).toBe(70);
    expect(data.attentionNeeded).toEqual([]);
    expect(data.tomorrowPriorities.length).toBeGreaterThan(0);
  });
});

describe("buildWeeklyExecutiveRollup / buildMonthlyBoardReport", () => {
  function dailyReport(data: ExecutiveSummaryData): AIReport<ExecutiveSummaryData> {
    return { id: "r", moduleId: "ceo-assistant", cadence: "daily", generatedAt: "2026-07-12T00:00:00.000Z", status: "success", summary: "", data };
  }

  it("handles an empty week/month without throwing", () => {
    expect(buildWeeklyExecutiveRollup("x", []).daysAggregated).toBe(0);
    expect(buildMonthlyBoardReport("x", []).daysAggregated).toBe(0);
  });

  it("aggregates across multiple daily reports", () => {
    const summary = buildExecutiveSummary("x", marketingIntel(), marketingOp(), metaAds(), sales({ overallProgressPct: 50 }), finance(), []);
    const rollup = buildWeeklyExecutiveRollup("x", [dailyReport(summary), dailyReport({ ...summary, sales: { ...summary.sales, overallProgressPct: 70 } })]);
    expect(rollup.avgSalesProgressPct).toBe(60);
    expect(rollup.daysAggregated).toBe(2);
  });
});
