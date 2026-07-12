export type SocialPlatform = "instagram" | "tiktok";

export type TrendCategory = "google" | "property" | "villa" | "skincare";

/**
 * One piece of viral content discovered during research. `externalId` is
 * the dedup key Marketing Intelligence's knowledge base uses — a real
 * adapter would set this to the platform's own post id.
 */
export interface ViralContentItem {
  externalId: string;
  platform: SocialPlatform;
  title: string;
  url?: string;
  postedAt: string;
  engagementScore: number;
  format: string;
  theme: string;
}

export interface CompetitorActivity {
  externalId: string;
  competitorName: string;
  platform: SocialPlatform;
  followers: number;
  postFrequencyPerWeek: number;
  standoutTheme: string;
}

export interface MarketTrendSignal {
  externalId: string;
  category: TrendCategory;
  keyword: string;
  momentum: "rising" | "steady" | "declining";
  note: string;
}

export interface AdCampaign {
  campaignId: string;
  name: string;
  status: "active" | "paused";
  objective: string;
  dailyBudgetIdr: number;
  spendIdr: number;
  impressions: number;
  clicks: number;
  leads: number;
}
