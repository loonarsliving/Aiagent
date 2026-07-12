import type { AdCampaign } from "../types";

/**
 * Read-only by design. Meta Ads AI's job this phase is analysis +
 * recommendation + Approval Request — publishing/mutating a real campaign
 * is a distinct future phase that needs its own explicit sign-off, so no
 * execute/publish method exists on this port yet.
 */
export interface MetaAdsConnector {
  getCampaigns(): Promise<AdCampaign[]>;
}
