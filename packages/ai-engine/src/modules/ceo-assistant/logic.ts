import type { FinanceTransaction } from "@mkh/database";
import type { FinanceAnalysisData } from "../finance-analyst/types";
import type { MarketingStrategyData } from "../marketing-strategist/types";
import type { MetaAdsAnalysisData } from "../meta-ads-operator/types";
import type { SalesSupervisionData } from "../sales-supervisor/types";
import type { ExecutiveSummaryData } from "./types";

export function buildPropertyBreakdown(transactions: FinanceTransaction[]): ExecutiveSummaryData["property"] {
  const sum = (category: string) =>
    transactions.filter((t) => t.type === "income" && t.category === category).reduce((s, t) => s + t.amountIdr, 0);
  return {
    villaIncomeIdr: sum("Penjualan Villa"),
    perumahanIncomeIdr: sum("Penjualan Perumahan"),
  };
}

export function buildDecisionsNeeded(
  metaAds: MetaAdsAnalysisData,
  sales: SalesSupervisionData,
  finance: FinanceAnalysisData,
): string[] {
  const decisions: string[] = [];

  for (const rec of metaAds.recommendations) {
    if (rec.action !== "no_action") {
      decisions.push(`Meta Ads: ${rec.campaignName} — ${rec.action.replace(/_/g, " ")} (${rec.reason})`);
    }
  }
  for (const rep of sales.laggingReps) {
    decisions.push(`Sales: ${rep.name} (${rep.branch}) tertinggal di ${rep.progressPct}% target.`);
  }
  for (const a of finance.anomalies) {
    decisions.push(`Finance: transaksi tidak biasa pada kategori "${a.category}" — ${a.reasonFlagged}`);
  }
  return decisions;
}

export function buildExecutiveSummary(
  periodLabel: string,
  marketing: MarketingStrategyData,
  metaAds: MetaAdsAnalysisData,
  sales: SalesSupervisionData,
  finance: FinanceAnalysisData,
  transactions: FinanceTransaction[],
): ExecutiveSummaryData {
  const actionable = metaAds.recommendations.filter((r) => r.action !== "no_action");

  return {
    periodLabel,
    sales: {
      headline: `Progress ${sales.overallProgressPct}% dari target, ${sales.laggingReps.length}/${sales.reps.length} sales tertinggal.`,
      overallProgressPct: sales.overallProgressPct,
      laggingCount: sales.laggingReps.length,
      totalReps: sales.reps.length,
    },
    marketing: {
      headline: `${marketing.contentIdeas.length} ide konten baru minggu ini.`,
      dailyRecommendation: marketing.dailyRecommendation,
    },
    metaAds: {
      headline: `${actionable.length} campaign butuh keputusan Owner.`,
      actionableCount: actionable.length,
    },
    finance: {
      headline: `Net cashflow Rp${finance.netCashflowIdr.toLocaleString("id-ID")}.`,
      netCashflowIdr: finance.netCashflowIdr,
      cashflowProjectionNext7dIdr: finance.cashflowProjectionNext7dIdr,
      anomalyCount: finance.anomalies.length,
    },
    property: buildPropertyBreakdown(transactions),
    decisionsNeeded: buildDecisionsNeeded(metaAds, sales, finance),
  };
}
