import { createLogger } from "@mkh/shared";
import type { MetaAdsActionType } from "@mkh/shared";
import type { AdCampaign, MetaAdsActionResult } from "./types";

const logger = createLogger("connectors:meta-ads");

/** Mocked campaign performance — same shape a real Meta Marketing API `/insights` read would return. */
export async function getAdCampaigns(): Promise<AdCampaign[]> {
  return [
    { campaignId: "cmp_001", name: "Villa Blok C - Leads", status: "active", objective: "LEAD_GENERATION", dailyBudgetIdr: 500_000, spendIdr: 3_400_000, impressions: 182_000, clicks: 2_450, leads: 61 },
    { campaignId: "cmp_002", name: "Perumahan Blok A - Awareness", status: "active", objective: "AWARENESS", dailyBudgetIdr: 300_000, spendIdr: 2_100_000, impressions: 410_000, clicks: 3_800, leads: 12 },
    { campaignId: "cmp_003", name: "Villa Blok D - Leads (Retarget)", status: "active", objective: "LEAD_GENERATION", dailyBudgetIdr: 250_000, spendIdr: 1_750_000, impressions: 64_000, clicks: 980, leads: 44 },
    { campaignId: "cmp_004", name: "Perumahan Blok B - Leads", status: "active", objective: "LEAD_GENERATION", dailyBudgetIdr: 400_000, spendIdr: 2_800_000, impressions: 96_000, clicks: 610, leads: 4 },
  ];
}

/**
 * Executes a Meta Ads action. This NEVER calls the real Marketing API — it
 * is only reachable after `assertApproved()` (see @mkh/security) has passed,
 * and even then it just simulates a successful call. Wire in the real
 * `POST /{campaign-id}` call here once Stage 2 is approved for production use.
 */
export async function executeMetaAdsAction(
  actionType: MetaAdsActionType,
  campaignId: string,
  proposedChange: Record<string, unknown>,
): Promise<MetaAdsActionResult> {
  logger.info("executing mocked Meta Ads action", { actionType, campaignId, proposedChange });
  return {
    success: true,
    detail: `[MOCK] ${actionType} applied to ${campaignId} with ${JSON.stringify(proposedChange)}`,
  };
}
