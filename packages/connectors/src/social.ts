import { createLogger } from "@mkh/shared";
import type { CompetitorSnapshot, SocialAccountSnapshot, TrendSignal } from "./types";

const logger = createLogger("connectors:social");

/**
 * All functions below are mocked — they never make a network call, even if
 * INSTAGRAM_GRAPH_TOKEN / TIKTOK_API_TOKEN are set. When real integration is
 * approved, swap the body for an actual Graph API / TikTok API call while
 * keeping the same return shape so marketing-strategist doesn't change.
 */

export async function getInstagramSnapshot(): Promise<SocialAccountSnapshot> {
  logger.debug("returning mocked Instagram snapshot");
  return {
    platform: "instagram",
    followers: 18420,
    followersDelta7d: 132,
    avgEngagementRatePct: 3.4,
    topPosts: [
      {
        postId: "ig_001",
        platform: "instagram",
        caption: "Tur virtual Villa Blok C — sunset view",
        postedAt: daysAgo(2),
        likes: 940,
        comments: 61,
        shares: 88,
        reach: 21500,
        format: "reel",
      },
      {
        postId: "ig_002",
        platform: "instagram",
        caption: "Testimoni pemilik unit Perumahan Blok A",
        postedAt: daysAgo(5),
        likes: 512,
        comments: 34,
        shares: 22,
        reach: 9800,
        format: "carousel",
      },
    ],
  };
}

export async function getTikTokSnapshot(): Promise<SocialAccountSnapshot> {
  logger.debug("returning mocked TikTok snapshot");
  return {
    platform: "tiktok",
    followers: 9350,
    followersDelta7d: 410,
    avgEngagementRatePct: 6.1,
    topPosts: [
      {
        postId: "tt_001",
        platform: "tiktok",
        caption: "POV: cicilan villa lebih murah dari kos",
        postedAt: daysAgo(1),
        likes: 15200,
        comments: 340,
        shares: 980,
        reach: 210000,
        format: "video",
      },
      {
        postId: "tt_002",
        platform: "tiktok",
        caption: "Behind the scenes konstruksi tahap 2",
        postedAt: daysAgo(4),
        likes: 3100,
        comments: 88,
        shares: 140,
        reach: 54000,
        format: "video",
      },
    ],
  };
}

export async function getCompetitorSnapshots(): Promise<CompetitorSnapshot[]> {
  return [
    { name: "Griya Asri Kendari", platform: "instagram", followers: 22100, postFrequencyPerWeek: 5, standoutContentTheme: "Cicilan ringan & testimoni" },
    { name: "Kendari Land Property", platform: "tiktok", followers: 31500, postFrequencyPerWeek: 9, standoutContentTheme: "POV komedi + harga tanah" },
  ];
}

export async function getTrendSignals(): Promise<TrendSignal[]> {
  return [
    { label: "POV cicilan vs kos/kontrak", platform: "tiktok", momentum: "rising", suggestedAngle: "Bandingkan cicilan villa/perumahan MKH dengan kos bulanan" },
    { label: "Sunset/golden hour property tour", platform: "instagram", momentum: "steady", suggestedAngle: "Reel tur singkat unit dengan musik trending" },
    { label: "Testimoni suara asli pemilik", platform: "tiktok", momentum: "rising", suggestedAngle: "Wawancara singkat pemilik unit baru, subtitle besar" },
  ];
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}
