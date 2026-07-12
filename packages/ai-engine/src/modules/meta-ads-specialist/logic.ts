import type { AdCampaign } from "@mkh/connectors";
import type { AIReport, ApprovalRequest } from "@mkh/shared";
import type { CampaignMetrics, CampaignRecommendation, MetaAdsAnalysisData, MonthlyAdsRecap, NewCampaignProposal, WeeklyCampaignComparison } from "./types";

export const NEW_CAMPAIGN_DEFAULT_BUDGET_IDR = 300_000;
export const NEW_CAMPAIGN_PUBLISH_LEAD_DAYS = 2;

/** Thresholds are intentionally simple/explainable — tune per real historical data once integrated. */
export const CPL_TARGET_IDR = 80_000;
export const CPL_GOOD_IDR = 40_000;
export const MIN_SPEND_FOR_ZERO_LEAD_PAUSE_IDR = 1_000_000;
export const BUDGET_STEP_PCT = 0.2;

export function computeCampaignMetrics(campaign: AdCampaign): CampaignMetrics {
  const cplIdr = campaign.leads > 0 ? Math.round(campaign.spendIdr / campaign.leads) : null;
  const ctrPct = campaign.impressions > 0 ? Number(((campaign.clicks / campaign.impressions) * 100).toFixed(2)) : 0;
  const cpcIdr = campaign.clicks > 0 ? Math.round(campaign.spendIdr / campaign.clicks) : null;

  return {
    campaignId: campaign.campaignId,
    name: campaign.name,
    status: campaign.status,
    dailyBudgetIdr: campaign.dailyBudgetIdr,
    spendIdr: campaign.spendIdr,
    impressions: campaign.impressions,
    clicks: campaign.clicks,
    leads: campaign.leads,
    cplIdr,
    ctrPct,
    cpcIdr,
  };
}

export function recommendForCampaign(metrics: CampaignMetrics): CampaignRecommendation {
  const base = { campaignId: metrics.campaignId, campaignName: metrics.name };

  if (metrics.leads === 0 && metrics.spendIdr >= MIN_SPEND_FOR_ZERO_LEAD_PAUSE_IDR) {
    return {
      ...base,
      action: "pause_campaign",
      reason: `Sudah menghabiskan Rp${metrics.spendIdr.toLocaleString("id-ID")} tanpa satu lead pun.`,
      proposedChange: { status: "paused" },
    };
  }

  if (metrics.cplIdr !== null && metrics.cplIdr > CPL_TARGET_IDR) {
    return {
      ...base,
      action: "decrease_budget",
      reason: `CPL Rp${metrics.cplIdr.toLocaleString("id-ID")} di atas target Rp${CPL_TARGET_IDR.toLocaleString("id-ID")}.`,
      proposedChange: {
        dailyBudgetIdr: Math.round(metrics.dailyBudgetIdr * (1 - BUDGET_STEP_PCT)),
      },
    };
  }

  if (metrics.cplIdr !== null && metrics.cplIdr <= CPL_GOOD_IDR) {
    return {
      ...base,
      action: "increase_budget",
      reason: `CPL Rp${metrics.cplIdr.toLocaleString("id-ID")} sangat efisien (≤ Rp${CPL_GOOD_IDR.toLocaleString("id-ID")}), layak diperbesar.`,
      proposedChange: {
        dailyBudgetIdr: Math.round(metrics.dailyBudgetIdr * (1 + BUDGET_STEP_PCT)),
      },
    };
  }

  return {
    ...base,
    action: "no_action",
    reason: "Performa dalam rentang wajar, tidak perlu perubahan saat ini.",
    proposedChange: {},
  };
}

/**
 * Drafts a brand-new campaign proposal from Marketing Intelligence's
 * strongest opportunity of the day — every field the brief asks for
 * (objective/audience/budget/creative/publish time). Returns null when
 * there's no fresh opportunity to act on, or when a proposal for the same
 * theme was already made recently (avoids spamming the Owner with
 * duplicate approval requests).
 */
export function draftNewCampaignProposal(topOpportunity: string | undefined, recentlyProposedTitles: Set<string>): NewCampaignProposal | null {
  if (!topOpportunity) return null;
  const title = `Campaign baru — ${topOpportunity}`;
  if (recentlyProposedTitles.has(title)) return null;

  const publishDate = new Date(Date.now() + NEW_CAMPAIGN_PUBLISH_LEAD_DAYS * 86_400_000);

  return {
    title,
    objective: "LEAD_GENERATION",
    audienceDescription: "Usia 25-45, berdomisili Sulawesi Tenggara & sekitarnya, tertarik properti/investasi",
    dailyBudgetIdr: NEW_CAMPAIGN_DEFAULT_BUDGET_IDR,
    creativeRecommendation: `Video/reel pendek bertema "${topOpportunity}" dengan CTA simulasi cicilan gratis.`,
    suggestedPublishAt: publishDate.toISOString().slice(0, 10),
    reason: `Marketing Intelligence menemukan sinyal kuat: "${topOpportunity}".`,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Converts a drafted proposal into the same CampaignRecommendation shape budget-adjustment recommendations use, so it flows through the exact same propose/decide workflow (see workflow.ts). */
export function newCampaignProposalToRecommendation(proposal: NewCampaignProposal): CampaignRecommendation {
  return {
    campaignId: `new_${slugify(proposal.title)}`,
    campaignName: proposal.title,
    action: "launch_new_campaign",
    reason: proposal.reason,
    proposedChange: {
      objective: proposal.objective,
      audienceDescription: proposal.audienceDescription,
      dailyBudgetIdr: proposal.dailyBudgetIdr,
      creativeRecommendation: proposal.creativeRecommendation,
      suggestedPublishAt: proposal.suggestedPublishAt,
    },
  };
}

export function buildWeeklyComparison(periodLabel: string, dailyReports: AIReport<MetaAdsAnalysisData>[]): WeeklyCampaignComparison {
  const actionableCounts = new Map<string, number>();
  let totalActionableRecommendations = 0;

  for (const report of dailyReports) {
    for (const rec of report.data?.recommendations ?? []) {
      if (rec.action === "no_action") continue;
      totalActionableRecommendations += 1;
      actionableCounts.set(rec.campaignName, (actionableCounts.get(rec.campaignName) ?? 0) + 1);
    }
  }

  const recurringCampaignIssues = Array.from(actionableCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  return { periodLabel, daysAggregated: dailyReports.length, totalActionableRecommendations, recurringCampaignIssues };
}

export function buildMonthlyAdsRecap(periodLabel: string, dailyReports: AIReport<MetaAdsAnalysisData>[], approvals: ApprovalRequest[]): MonthlyAdsRecap {
  const totalApprovalsProposed = dailyReports.reduce((sum, r) => sum + (r.data?.proposedApprovalIds.length ?? 0), 0);
  const approvalOutcomes = {
    approved: approvals.filter((a) => a.status === "approved").length,
    rejected: approvals.filter((a) => a.status === "rejected").length,
    pending: approvals.filter((a) => a.status === "pending").length,
  };

  const note =
    approvalOutcomes.pending > 0
      ? `${approvalOutcomes.pending} approval request masih menunggu keputusan Owner.`
      : "Semua approval request bulan ini sudah diputuskan.";

  return { periodLabel, daysAggregated: dailyReports.length, totalApprovalsProposed, approvalOutcomes, note };
}
