import type { AdCampaign } from "@mkh/connectors";
import type { CampaignMetrics, CampaignRecommendation } from "./types";

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
