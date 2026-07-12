import { generateId, type AIReport, type AIRunContext } from "@mkh/shared";
import { getCompetitorSnapshots, getInstagramSnapshot, getTikTokSnapshot, getTrendSignals } from "@mkh/connectors";
import type { AIModule } from "../../core/ai-module";
import { buildStrategyData } from "./logic";
import type { MarketingStrategyData } from "./types";

export const marketingStrategistModule: AIModule<MarketingStrategyData> = {
  id: "marketing-strategist",
  name: "Marketing Strategist AI",
  description:
    "Menganalisa Instagram, TikTok, dan kompetitor untuk menghasilkan ide konten, hook, CTA, waktu posting, dan checklist mingguan Markom.",

  async run(_context: AIRunContext): Promise<AIReport<MarketingStrategyData>> {
    const [ig, tiktok, competitors, trends] = await Promise.all([
      getInstagramSnapshot(),
      getTikTokSnapshot(),
      getCompetitorSnapshots(),
      getTrendSignals(),
    ]);

    const data = buildStrategyData([ig, tiktok], competitors, trends);

    return {
      id: generateId("rpt"),
      moduleId: "marketing-strategist",
      generatedAt: new Date().toISOString(),
      status: "success",
      summary: `${data.contentIdeas.length} ide konten baru, checklist 7 hari siap, rekomendasi hari ini: ${data.dailyRecommendation.slice(0, 80)}...`,
      data,
    };
  },
};
