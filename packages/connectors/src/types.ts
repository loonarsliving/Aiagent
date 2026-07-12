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

/**
 * One property/unit's OTA metrics for a given date. Belum konek OTA
 * sungguhan — mocked, but the shape (occupancy, ADR, competitor price,
 * booking pace, dynamic pricing) matches what a real OTA channel manager
 * API (e.g. Booking.com/Agoda partner API) would return, so OTA Manager's
 * logic is ready to run unchanged the day a real adapter replaces the mock.
 */
export interface OTAPropertySnapshot {
  propertyId: string;
  propertyName: string;
  date: string;
  roomsTotal: number;
  roomsBooked: number;
  occupancyPct: number;
  /** Average Daily Rate. */
  adrIdr: number;
  competitorAvgPriceIdr: number;
  /** Bookings-per-day vs. the same point in the previous period; 100 = same pace, >100 = faster, <100 = slower. */
  bookingPaceIndex: number;
  /** The price currently active on the OTA channel's own dynamic pricing engine (input data, not the AI's recommendation). */
  currentDynamicPriceIdr: number;
}
