import { createLogger } from "@mkh/shared";
import type { MetaAdsConnector } from "../../ports/meta-ads.port";
import type { AdCampaign } from "../../types";

const logger = createLogger("connectors:meta-ads:mock");

/** Mocked campaign performance — same shape a real Meta Marketing API `/insights` read would return. Read-only; see meta-ads.port.ts for why there's no write method. */
export const mockMetaAdsAdapter: MetaAdsConnector = {
  async getCampaigns(): Promise<AdCampaign[]> {
    logger.debug("returning mocked campaign performance");
    return [
      { campaignId: "cmp_001", name: "Villa Blok C - Leads", status: "active", objective: "LEAD_GENERATION", dailyBudgetIdr: 500_000, spendIdr: 3_400_000, impressions: 182_000, clicks: 2_450, leads: 61 },
      { campaignId: "cmp_002", name: "Perumahan Blok A - Awareness", status: "active", objective: "AWARENESS", dailyBudgetIdr: 300_000, spendIdr: 2_100_000, impressions: 410_000, clicks: 3_800, leads: 12 },
      { campaignId: "cmp_003", name: "Villa Blok D - Leads (Retarget)", status: "active", objective: "LEAD_GENERATION", dailyBudgetIdr: 250_000, spendIdr: 1_750_000, impressions: 64_000, clicks: 980, leads: 44 },
      { campaignId: "cmp_004", name: "Perumahan Blok B - Leads", status: "active", objective: "LEAD_GENERATION", dailyBudgetIdr: 400_000, spendIdr: 2_800_000, impressions: 96_000, clicks: 610, leads: 4 },
    ];
  },
};
