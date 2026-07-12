import { generateId, type AIReport, type AIRunContext } from "@mkh/shared";
import { getAdCampaigns } from "@mkh/connectors";
import type { AIModule } from "../../core/ai-module";
import { computeCampaignMetrics, recommendForCampaign } from "./logic";
import type { MetaAdsAnalysisData } from "./types";

/**
 * Stage 1 only: read Meta Ads performance, compute CPL/CTR/CPC, produce
 * recommendations. This module NEVER changes a campaign itself — see
 * workflow.ts for the Stage 2 approval-gated action path.
 */
export const metaAdsOperatorModule: AIModule<MetaAdsAnalysisData> = {
  id: "meta-ads-operator",
  name: "Meta Ads Operator AI",
  description:
    "Membaca performa Meta Ads, menghitung CPL/CTR/CPC, membandingkan campaign, dan memberi rekomendasi. Perubahan budget/status hanya lewat alur approval Owner.",

  async run(_context: AIRunContext): Promise<AIReport<MetaAdsAnalysisData>> {
    const campaigns = await getAdCampaigns();
    const metrics = campaigns.map(computeCampaignMetrics);
    const recommendations = metrics.map(recommendForCampaign);
    const actionable = recommendations.filter((r) => r.action !== "no_action");

    return {
      id: generateId("rpt"),
      moduleId: "meta-ads-operator",
      generatedAt: new Date().toISOString(),
      status: "success",
      summary: `${metrics.length} campaign dianalisa, ${actionable.length} butuh perhatian/approval Owner.`,
      data: { campaigns: metrics, recommendations },
    };
  },
};
