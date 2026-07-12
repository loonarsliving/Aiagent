export interface SocialPostInsight {
  postId: string;
  platform: "instagram" | "tiktok";
  caption: string;
  postedAt: string;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  format: "reel" | "carousel" | "single_image" | "video";
}

export interface SocialAccountSnapshot {
  platform: "instagram" | "tiktok";
  followers: number;
  followersDelta7d: number;
  avgEngagementRatePct: number;
  topPosts: SocialPostInsight[];
}

export interface CompetitorSnapshot {
  name: string;
  platform: "instagram" | "tiktok";
  followers: number;
  postFrequencyPerWeek: number;
  standoutContentTheme: string;
}

export interface TrendSignal {
  label: string;
  platform: "instagram" | "tiktok";
  momentum: "rising" | "steady" | "declining";
  suggestedAngle: string;
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

export interface MetaAdsActionResult {
  success: boolean;
  detail: string;
}
