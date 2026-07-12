import type { FinanceTransaction } from "@mkh/database";
import type { AIReport } from "@mkh/shared";
import type { FinanceAnalysisData } from "../finance-analyst/types";
import type { DailyResearchSummary } from "../marketing-intelligence/types";
import type { OperationsPlan } from "../marketing-operation/types";
import type { MetaAdsAnalysisData } from "../meta-ads-operator/types";
import type { SalesSupervisionData } from "../sales-supervisor/types";
import type { ExecutiveSummaryData, MonthlyBoardReport, WeeklyExecutiveRollup } from "./types";

export function buildPropertyBreakdown(transactions: FinanceTransaction[]): ExecutiveSummaryData["property"] {
  const sum = (category: string) =>
    transactions.filter((t) => t.type === "income" && t.category === category).reduce((s, t) => s + t.amountIdr, 0);
  return {
    villaIncomeIdr: sum("Penjualan Villa"),
    perumahanIncomeIdr: sum("Penjualan Perumahan"),
  };
}

export function buildAttentionNeeded(
  metaAds: MetaAdsAnalysisData,
  sales: SalesSupervisionData,
  finance: FinanceAnalysisData,
  marketingOperation: OperationsPlan,
): string[] {
  const items: string[] = [];

  for (const rec of metaAds.recommendations) {
    if (rec.action !== "no_action") {
      items.push(`Meta Ads: ${rec.campaignName} — ${rec.action.replace(/_/g, " ")} (${rec.reason})`);
    }
  }
  for (const rep of sales.laggingReps) {
    items.push(`Sales: ${rep.name} (${rep.branch}) tertinggal di ${rep.progressPct}% target.`);
  }
  for (const a of finance.anomalies) {
    items.push(`Finance: transaksi tidak biasa pada kategori "${a.category}" — ${a.reasonFlagged}`);
  }
  if (marketingOperation.incompleteCount > 0) {
    items.push(`Marketing: ${marketingOperation.incompleteCount} tugas checklist Markom belum selesai.`);
  }

  return items;
}

export function buildRecommendations(
  marketingIntelligence: DailyResearchSummary,
  metaAds: MetaAdsAnalysisData,
  sales: SalesSupervisionData,
): string[] {
  const recommendations: string[] = [];

  if (marketingIntelligence.dailyRecommendation) {
    recommendations.push(marketingIntelligence.dailyRecommendation);
  }
  const actionable = metaAds.recommendations.filter((r) => r.action !== "no_action");
  if (actionable.length > 0) {
    recommendations.push(`Tinjau & putuskan ${actionable.length} Approval Request Meta Ads yang menunggu.`);
  }
  if (sales.laggingReps.length > 0) {
    recommendations.push(`Minta Dir Ops follow up ${sales.laggingReps.length} sales yang tertinggal target.`);
  }

  return recommendations;
}

export function buildTomorrowPriorities(attentionNeeded: string[], marketingIntelligence: DailyResearchSummary): string[] {
  const priorities = attentionNeeded.slice(0, 3);
  if (marketingIntelligence.topOpportunities[0]) {
    priorities.push(`Lanjutkan eksekusi peluang konten: "${marketingIntelligence.topOpportunities[0]}".`);
  }
  if (priorities.length === 0) {
    priorities.push("Tidak ada prioritas mendesak — lanjutkan operasional rutin.");
  }
  return priorities;
}

export function buildExecutiveSummary(
  periodLabel: string,
  marketingIntelligence: DailyResearchSummary,
  marketingOperation: OperationsPlan,
  metaAds: MetaAdsAnalysisData,
  sales: SalesSupervisionData,
  finance: FinanceAnalysisData,
  transactions: FinanceTransaction[],
): ExecutiveSummaryData {
  const actionable = metaAds.recommendations.filter((r) => r.action !== "no_action");
  const attentionNeeded = buildAttentionNeeded(metaAds, sales, finance, marketingOperation);

  return {
    periodLabel,
    sales: {
      headline: `Progress ${sales.overallProgressPct}% dari target, ${sales.laggingReps.length}/${sales.reps.length} sales tertinggal.`,
      overallProgressPct: sales.overallProgressPct,
      laggingCount: sales.laggingReps.length,
      totalReps: sales.reps.length,
    },
    marketingIntelligence: {
      headline: `${marketingIntelligence.newSignals} sinyal riset baru hari ini.`,
      dailyRecommendation: marketingIntelligence.dailyRecommendation,
      newSignals: marketingIntelligence.newSignals,
    },
    marketingOperation: {
      headline: marketingOperation.prioritySummary,
      incompleteCount: marketingOperation.incompleteCount,
    },
    metaAds: {
      headline: `${actionable.length} campaign butuh keputusan Owner.`,
      actionableCount: actionable.length,
      proposedApprovalIds: metaAds.proposedApprovalIds,
    },
    finance: {
      headline: `Net cashflow Rp${finance.netCashflowIdr.toLocaleString("id-ID")}.`,
      netCashflowIdr: finance.netCashflowIdr,
      cashflowProjectionNext7dIdr: finance.cashflowProjectionNext7dIdr,
      anomalyCount: finance.anomalies.length,
    },
    property: buildPropertyBreakdown(transactions),
    attentionNeeded,
    recommendations: buildRecommendations(marketingIntelligence, metaAds, sales),
    tomorrowPriorities: buildTomorrowPriorities(attentionNeeded, marketingIntelligence),
  };
}

export function buildWeeklyExecutiveRollup(periodLabel: string, dailyReports: AIReport<ExecutiveSummaryData>[]): WeeklyExecutiveRollup {
  if (dailyReports.length === 0) {
    return { periodLabel, daysAggregated: 0, avgSalesProgressPct: 0, totalMetaAdsApprovalsProposed: 0, totalFinanceAnomalies: 0, topAttentionThemes: [] };
  }

  const avgSalesProgressPct = Number(
    (dailyReports.reduce((sum, r) => sum + (r.data?.sales.overallProgressPct ?? 0), 0) / dailyReports.length).toFixed(1),
  );
  const totalMetaAdsApprovalsProposed = dailyReports.reduce((sum, r) => sum + (r.data?.metaAds.proposedApprovalIds.length ?? 0), 0);
  const totalFinanceAnomalies = dailyReports.reduce((sum, r) => sum + (r.data?.finance.anomalyCount ?? 0), 0);

  const themeCounts = new Map<string, number>();
  for (const report of dailyReports) {
    for (const item of report.data?.attentionNeeded ?? []) {
      const theme = item.split(":")[0] ?? item;
      themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
    }
  }
  const topAttentionThemes = Array.from(themeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([theme]) => theme);

  return { periodLabel, daysAggregated: dailyReports.length, avgSalesProgressPct, totalMetaAdsApprovalsProposed, totalFinanceAnomalies, topAttentionThemes };
}

export function buildMonthlyBoardReport(periodLabel: string, dailyReports: AIReport<ExecutiveSummaryData>[]): MonthlyBoardReport {
  if (dailyReports.length === 0) {
    return { periodLabel, daysAggregated: 0, summary: "Belum ada laporan harian bulan ini untuk direkap.", highlights: [] };
  }

  const totalAnomalies = dailyReports.reduce((sum, r) => sum + (r.data?.finance.anomalyCount ?? 0), 0);
  const totalApprovals = dailyReports.reduce((sum, r) => sum + (r.data?.metaAds.proposedApprovalIds.length ?? 0), 0);
  const finalProgress = dailyReports[dailyReports.length - 1]?.data?.sales.overallProgressPct ?? 0;

  const highlights = [
    `Progress sales akhir bulan: ${finalProgress}%.`,
    `${totalApprovals} Approval Request Meta Ads diajukan sepanjang bulan.`,
    `${totalAnomalies} transaksi tidak biasa terdeteksi sepanjang bulan.`,
  ];

  return {
    periodLabel,
    daysAggregated: dailyReports.length,
    summary: `Ringkasan ${dailyReports.length} hari operasional bulan ini.`,
    highlights,
  };
}
