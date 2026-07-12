import { createLogger } from "@mkh/shared";
import type { SocialResearchConnector } from "../../ports/social-research.port";
import type { CompetitorActivity, SocialPlatform, ViralContentItem } from "../../types";

const logger = createLogger("connectors:social-research:mock");

/** "YYYY-MM-DD" in the company timezone-ish (server local date is fine for a mock). */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

const EVERGREEN_INSTAGRAM: ViralContentItem[] = [
  { externalId: "ig_evergreen_sunset_tour", platform: "instagram", title: "Tur villa saat golden hour", url: "https://instagram.com/p/evergreen1", postedAt: "2026-06-01T10:00:00.000Z", engagementScore: 8600, format: "reel", theme: "property-tour" },
  { externalId: "ig_evergreen_testimoni", platform: "instagram", title: "Testimoni pemilik unit — suara asli", url: "https://instagram.com/p/evergreen2", postedAt: "2026-06-03T10:00:00.000Z", engagementScore: 5400, format: "carousel", theme: "testimonial" },
];

const EVERGREEN_TIKTOK: ViralContentItem[] = [
  { externalId: "tt_evergreen_cicilan_pov", platform: "tiktok", title: "POV: cicilan villa vs kos bulanan", url: "https://tiktok.com/@x/evergreen1", postedAt: "2026-06-02T10:00:00.000Z", engagementScore: 41000, format: "video", theme: "affordability-comparison" },
  { externalId: "tt_evergreen_construction_bts", platform: "tiktok", title: "Behind the scenes progres konstruksi", url: "https://tiktok.com/@x/evergreen2", postedAt: "2026-06-05T10:00:00.000Z", engagementScore: 12800, format: "video", theme: "transparency" },
];

/**
 * Mocked — never makes a network call. Returns a stable "evergreen" pool
 * plus one item whose id embeds today's date, so re-running on a new
 * calendar day yields a genuinely new discovery (and re-running the same
 * day is idempotent) — this is what lets the knowledge base visibly grow
 * day over day instead of just replaying the same result. Swap this
 * adapter's body for a real Instagram Graph API / TikTok API call later;
 * the SocialResearchConnector shape stays the same.
 */
export const mockSocialResearchAdapter: SocialResearchConnector = {
  async getViralContent(platform: SocialPlatform): Promise<ViralContentItem[]> {
    const date = todayKey();
    if (platform === "instagram") {
      logger.debug("mock viral content lookup", { platform });
      return [
        ...EVERGREEN_INSTAGRAM,
        {
          externalId: `ig_daily_${date}`,
          platform: "instagram",
          title: `Konten properti trending IG (${date})`,
          postedAt: new Date().toISOString(),
          engagementScore: 3000 + (date.length * 137) % 4000,
          format: "reel",
          theme: "daily-discovery",
        },
      ];
    }
    logger.debug("mock viral content lookup", { platform });
    return [
      ...EVERGREEN_TIKTOK,
      {
        externalId: `tt_daily_${date}`,
        platform: "tiktok",
        title: `Konten properti trending TikTok (${date})`,
        postedAt: new Date().toISOString(),
        engagementScore: 8000 + (date.length * 271) % 9000,
        format: "video",
        theme: "daily-discovery",
      },
    ];
  },

  async getCompetitorActivity(): Promise<CompetitorActivity[]> {
    return [
      { externalId: "cmp_griya_asri", competitorName: "Griya Asri Kendari", platform: "instagram", followers: 22100, postFrequencyPerWeek: 5, standoutTheme: "Cicilan ringan & testimoni" },
      { externalId: "cmp_kendari_land", competitorName: "Kendari Land Property", platform: "tiktok", followers: 31500, postFrequencyPerWeek: 9, standoutTheme: "POV komedi + harga tanah" },
    ];
  },
};
