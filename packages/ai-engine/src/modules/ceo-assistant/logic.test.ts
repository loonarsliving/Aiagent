import { describe, expect, it } from "vitest";
import type { FinanceTransaction } from "@mkh/database";
import type { AIReport } from "@mkh/shared";
import type { BranchPerformanceData } from "../branch-performance-manager/types";
import type { DailyContentPlan } from "../content-planner/types";
import type { FinanceAnalysisData } from "../finance-analyst/types";
import type { HRAnalysisData } from "../hr-officer/types";
import type { DailyResearchSummary } from "../marketing-intelligence/types";
import type { MetaAdsAnalysisData } from "../meta-ads-specialist/types";
import type { OTAManagerData } from "../ota-manager/types";
import type { SalesSupervisionData } from "../sales-supervisor/types";
import type { SOPComplianceData } from "../sop-guardian/types";
import {
  buildAttentionNeeded,
  buildExecutiveSummary,
  buildMonthlyBoardReport,
  buildPropertyBreakdown,
  buildRecommendations,
  buildTomorrowPriorities,
  buildWeeklyExecutiveRollup,
  type ExecutiveSummaryInputs,
} from "./logic";
import type { ExecutiveSummaryData } from "./types";

function metaAds(overrides: Partial<MetaAdsAnalysisData> = {}): MetaAdsAnalysisData {
  return { campaigns: [], recommendations: [], newCampaignProposals: [], proposedApprovalIds: [], ...overrides };
}

function sales(overrides: Partial<SalesSupervisionData> = {}): SalesSupervisionData {
  return { periodLabel: "x", overallProgressPct: 70, reps: [], laggingReps: [], ...overrides };
}

function finance(overrides: Partial<FinanceAnalysisData> = {}): FinanceAnalysisData {
  return { periodLabel: "x", totalIncomeIdr: 0, totalExpenseIdr: 0, netCashflowIdr: 0, cashflowProjectionNext7dIdr: 0, anomalies: [], ...overrides };
}

function contentPlanner(overrides: Partial<DailyContentPlan> = {}): DailyContentPlan {
  return { checklist: [], incompleteCount: 0, remindersSent: 0, prioritySummary: "semua aman", freshThemeCount: 0, ...overrides };
}

function marketingIntel(overrides: Partial<DailyResearchSummary> = {}): DailyResearchSummary {
  return { newSignals: 0, recurringSignals: 0, totalKnowledgeItems: 0, topOpportunities: [], dailyRecommendation: "", contentChecklist: [], ...overrides };
}

function branches(overrides: Partial<BranchPerformanceData> = {}): BranchPerformanceData {
  return { periodLabel: "x", branches: [], branchesNeedingAttention: [], ...overrides };
}

function hr(overrides: Partial<HRAnalysisData> = {}): HRAnalysisData {
  return { periodLabel: "x", totalStaff: 0, avgKpiScore: 0, flaggedStaff: [], ...overrides };
}

function ota(overrides: Partial<OTAManagerData> = {}): OTAManagerData {
  return { periodLabel: "x", properties: [], propertiesNeedingAction: [], ...overrides };
}

function sopCompliance(overrides: Partial<SOPComplianceData> = {}): SOPComplianceData {
  return { periodLabel: "x", employeesChecked: 9, violations: [], compliantModuleIds: [], ...overrides };
}

function baseInputs(overrides: Partial<ExecutiveSummaryInputs> = {}): ExecutiveSummaryInputs {
  return {
    marketingIntelligence: marketingIntel(),
    contentPlanner: contentPlanner(),
    metaAds: metaAds(),
    sales: sales(),
    branches: branches(),
    finance: finance(),
    hr: hr(),
    ota: ota(),
    sopCompliance: sopCompliance(),
    transactions: [],
    ...overrides,
  };
}

describe("buildAttentionNeeded", () => {
  it("collects actionable items from every source", () => {
    const items = buildAttentionNeeded(
      baseInputs({
        metaAds: metaAds({ recommendations: [{ campaignId: "c1", campaignName: "Camp A", action: "pause_campaign", reason: "no leads", proposedChange: {} }] }),
        sales: sales({ laggingReps: [{ repId: "r1", name: "Budi", branch: "Makassar", targetIdr: 1, achievedIdr: 0, progressPct: 10, status: "lagging", lastActivityDaysAgo: 9, strategyType: "recovery", strategy: "x" }] }),
        finance: finance({ anomalies: [{ transactionId: "t1", category: "Operasional", amountIdr: 1, description: "x", reasonFlagged: "outlier" }] }),
        contentPlanner: contentPlanner({ incompleteCount: 2 }),
        branches: branches({ branchesNeedingAttention: ["Kendari"] }),
        hr: hr({ flaggedStaff: [{ staffId: "s1", name: "Fajar", branch: "Kendari", role: "Sales", issues: ["keterlambatan"], attendanceRatePct: 60, kpiScore: 40, coachingRecommendation: "x" }] }),
        ota: ota({ propertiesNeedingAction: ["Villa Blok D"] }),
        sopCompliance: sopCompliance({ violations: [{ moduleId: "hr-officer", violationType: "missed_run", detail: "x", warning: "hr-officer missed run" }] }),
      }),
    );

    expect(items).toHaveLength(8);
    expect(items.some((i) => i.includes("Meta Ads"))).toBe(true);
    expect(items.some((i) => i.includes("Budi"))).toBe(true);
    expect(items.some((i) => i.includes("Finance"))).toBe(true);
    expect(items.some((i) => i.includes("Content Planner"))).toBe(true);
    expect(items.some((i) => i.includes("Kendari"))).toBe(true);
    expect(items.some((i) => i.includes("Fajar"))).toBe(true);
    expect(items.some((i) => i.includes("Villa Blok D"))).toBe(true);
    expect(items.some((i) => i.includes("SOP"))).toBe(true);
  });

  it("returns an empty list when everything is healthy", () => {
    expect(buildAttentionNeeded(baseInputs())).toHaveLength(0);
  });
});

describe("buildRecommendations", () => {
  it("surfaces marketing recommendation, meta ads approvals pending, and sales follow-up", () => {
    const recs = buildRecommendations(
      marketingIntel({ dailyRecommendation: "Fokus konten X" }),
      metaAds({ recommendations: [{ campaignId: "c1", campaignName: "A", action: "increase_budget", reason: "efisien", proposedChange: {} }] }),
      sales({ laggingReps: [{ repId: "r1", name: "Budi", branch: "Makassar", targetIdr: 1, achievedIdr: 0, progressPct: 10, status: "lagging", lastActivityDaysAgo: 9, strategyType: "recovery", strategy: "x" }] }),
    );
    expect(recs).toContain("Fokus konten X");
    expect(recs.some((r) => r.includes("Approval Request"))).toBe(true);
    expect(recs.some((r) => r.includes("follow up"))).toBe(true);
  });
});

describe("buildTomorrowPriorities", () => {
  it("takes the top attention items plus the strongest content opportunity", () => {
    const priorities = buildTomorrowPriorities(["Meta Ads: A", "Sales: B", "Finance: C", "Content Planner: D"], marketingIntel({ topOpportunities: ["Tema Utama"] }));
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
    const data = buildExecutiveSummary("hari ini", baseInputs());
    expect(data.periodLabel).toBe("hari ini");
    expect(data.sales.overallProgressPct).toBe(70);
    expect(data.attentionNeeded).toEqual([]);
    expect(data.tomorrowPriorities.length).toBeGreaterThan(0);
    expect(data.hr.avgKpiScore).toBe(0);
    expect(data.ota.propertiesNeedingActionCount).toBe(0);
    expect(data.sopCompliance.violationCount).toBe(0);
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
    const summaryA = buildExecutiveSummary("x", baseInputs({ sales: sales({ overallProgressPct: 50 }) }));
    const summaryB = buildExecutiveSummary("x", baseInputs({ sales: sales({ overallProgressPct: 70 }) }));
    const rollup = buildWeeklyExecutiveRollup("x", [dailyReport(summaryA), dailyReport(summaryB)]);
    expect(rollup.avgSalesProgressPct).toBe(60);
    expect(rollup.daysAggregated).toBe(2);
  });
});
