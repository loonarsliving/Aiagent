import type { CompetitorActivity, SocialPlatform, ViralContentItem } from "../types";

/**
 * What Marketing Intelligence needs from Instagram/TikTok research. A real
 * adapter (Instagram Graph API, TikTok for Business API) implements this
 * exact shape — see docs/CONNECTORS.md for what that swap looks like.
 */
export interface SocialResearchConnector {
  getViralContent(platform: SocialPlatform): Promise<ViralContentItem[]>;
  getCompetitorActivity(): Promise<CompetitorActivity[]>;
}
