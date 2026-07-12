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
import type { ExecutiveSummaryData, MonthlyBoardReport, WeeklyExecutiveRollup } from "./types";

/** Everything CEO Assistant reads from the other nine employees to compile the daily Executive Summary. */
export interface ExecutiveSummaryInputs {
  marketingIntelligence: DailyResearchSummary;
  contentPlanner: DailyContentPlan;
  metaAds: MetaAdsAnalysisData;
  sales: SalesSupervisionData;
  branches: BranchPerformanceData;
  finance: FinanceAnalysisData;
  hr: HRAnalysisData;
  ota: OTAManagerData;
  sopCompliance: SOPComplianceData;
  transactions: FinanceTransaction[];
}

export function buildPropertyBreakdown(transactions: FinanceTransaction[]): ExecutiveSummaryData["property"] {
  const sum = (category: string) =>
    transactions.filter((t) => t.type === "income" && t.category === category).reduce((s, t) => s + t.amountIdr, 0);
  return {
    villaIncomeIdr: sum("Penjualan Villa"),
    perumahanIncomeIdr: sum("Penjualan Perumahan"),
  };
}

export function buildAttentionNeeded(
  inputs: Pick<ExecutiveSummaryInputs, "metaAds" | "sales" | "finance" | "contentPlanner" | "branches" | "hr" | "ota" | "sopCompliance">,
): string[] {
  const { metaAds, sales, finance, contentPlanner, branches, hr, ota, sopCompliance } = inputs;
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
  if (contentPlanner.incompleteCount > 0) {
    items.push(`Content Planner: ${contentPlanner.incompleteCount} tugas checklist Markom belum selesai.`);
  }
  for (const branch of branches.branchesNeedingAttention) {
    items.push(`Cabang: ${branch} butuh perhatian Kepala Cabang.`);
  }
  for (const flag of hr.flaggedStaff) {
    items.push(`HR: ${flag.name} (${flag.branch}) — ${flag.issues.join(", ")}.`);
  }
  for (const property of ota.propertiesNeedingAction) {
    items.push(`OTA: ${property} direkomendasikan untuk penyesuaian harga.`);
  }
  for (const violation of sopCompliance.violations) {
    items.push(`SOP: ${violation.warning}`);
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

export function buildExecutiveSummary(periodLabel: string, inputs: ExecutiveSummaryInputs): ExecutiveSummaryData {
  const { marketingIntelligence, contentPlanner, metaAds, sales, branches, finance, hr, ota, sopCompliance, transactions } = inputs;
  const actionable = metaAds.recommendations.filter((r) => r.action !== "no_action");
  const attentionNeeded = buildAttentionNeeded({ metaAds, sales, finance, contentPlanner, branches, hr, ota, sopCompliance });

  return {
    periodLabel,
    sales: {
      headline: `Progress ${sales.overallProgressPct}% dari target, ${sales.laggingReps.length}/${sales.reps.length} sales tertinggal.`,
      overallProgressPct: sales.overallProgressPct,
      laggingCount: sales.laggingReps.length,
      totalReps: sales.reps.length,
    },
    branches: {
      headline: `${branches.branchesNeedingAttention.length}/${branches.branches.length} cabang butuh perhatian.`,
      branchesNeedingAttentionCount: branches.branchesNeedingAttention.length,
      totalBranches: branches.branches.length,
    },
    marketingIntelligence: {
      headline: `${marketingIntelligence.newSignals} sinyal riset baru hari ini.`,
      dailyRecommendation: marketingIntelligence.dailyRecommendation,
      newSignals: marketingIntelligence.newSignals,
    },
    contentPlanner: {
      headline: contentPlanner.prioritySummary,
      incompleteCount: contentPlanner.incompleteCount,
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
    hr: {
      headline: `${hr.flaggedStaff.length}/${hr.totalStaff} staff butuh perhatian, rata-rata KPI ${hr.avgKpiScore}.`,
      flaggedStaffCount: hr.flaggedStaff.length,
      avgKpiScore: hr.avgKpiScore,
    },
    ota: {
      headline: `${ota.propertiesNeedingAction.length}/${ota.properties.length} properti direkomendasikan penyesuaian harga.`,
      propertiesNeedingActionCount: ota.propertiesNeedingAction.length,
    },
    sopCompliance: {
      headline: `${sopCompliance.violations.length} pelanggaran SOP terdeteksi dari ${sopCompliance.employeesChecked} AI.`,
      violationCount: sopCompliance.violations.length,
    },
    property: buildPropertyBreakdown(transactions),
    attentionNeeded,
    recommendations: buildRecommendations(marketingIntelligence, metaAds, sales),
    tomorrowPriorities: buildTomorrowPriorities(attentionNeeded, marketingIntelligence),
  };
}

export function buildWeeklyExecutiveRollup(periodLabel: string, dailyReports: AIReport<ExecutiveSummaryData>[]): WeeklyExecutiveRollup {
  if (dailyReports.length === 0) {
    return {
      periodLabel,
      daysAggregated: 0,
      avgSalesProgressPct: 0,
      totalMetaAdsApprovalsProposed: 0,
      totalFinanceAnomalies: 0,
      totalSOPViolations: 0,
      topAttentionThemes: [],
    };
  }

  const avgSalesProgressPct = Number(
    (dailyReports.reduce((sum, r) => sum + (r.data?.sales.overallProgressPct ?? 0), 0) / dailyReports.length).toFixed(1),
  );
  const totalMetaAdsApprovalsProposed = dailyReports.reduce((sum, r) => sum + (r.data?.metaAds.proposedApprovalIds.length ?? 0), 0);
  const totalFinanceAnomalies = dailyReports.reduce((sum, r) => sum + (r.data?.finance.anomalyCount ?? 0), 0);
  const totalSOPViolations = dailyReports.reduce((sum, r) => sum + (r.data?.sopCompliance.violationCount ?? 0), 0);

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

  return { periodLabel, daysAggregated: dailyReports.length, avgSalesProgressPct, totalMetaAdsApprovalsProposed, totalFinanceAnomalies, totalSOPViolations, topAttentionThemes };
}

export function buildMonthlyBoardReport(periodLabel: string, dailyReports: AIReport<ExecutiveSummaryData>[]): MonthlyBoardReport {
  if (dailyReports.length === 0) {
    return { periodLabel, daysAggregated: 0, summary: "Belum ada laporan harian bulan ini untuk direkap.", highlights: [] };
  }

  const totalAnomalies = dailyReports.reduce((sum, r) => sum + (r.data?.finance.anomalyCount ?? 0), 0);
  const totalApprovals = dailyReports.reduce((sum, r) => sum + (r.data?.metaAds.proposedApprovalIds.length ?? 0), 0);
  const totalSOPViolations = dailyReports.reduce((sum, r) => sum + (r.data?.sopCompliance.violationCount ?? 0), 0);
  const finalProgress = dailyReports[dailyReports.length - 1]?.data?.sales.overallProgressPct ?? 0;

  const highlights = [
    `Progress sales akhir bulan: ${finalProgress}%.`,
    `${totalApprovals} Approval Request Meta Ads diajukan sepanjang bulan.`,
    `${totalAnomalies} transaksi tidak biasa terdeteksi sepanjang bulan.`,
    `${totalSOPViolations} pelanggaran SOP tercatat sepanjang bulan.`,
  ];

  return {
    periodLabel,
    daysAggregated: dailyReports.length,
    summary: `Ringkasan ${dailyReports.length} hari operasional bulan ini.`,
    highlights,
  };
}
