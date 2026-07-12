import type { SocialResearchConnector } from "./ports/social-research.port";
import type { TrendConnector } from "./ports/trend.port";
import type { MetaAdsConnector } from "./ports/meta-ads.port";
import type { ExternalSystemConnector } from "./ports/external-system.port";
import type { OTAConnector } from "./ports/ota.port";
import { mockSocialResearchAdapter } from "./adapters/mock/mock-social-research.adapter";
import { mockTrendAdapter } from "./adapters/mock/mock-trend.adapter";
import { mockMetaAdsAdapter } from "./adapters/mock/mock-meta-ads.adapter";
import { mockExternalSystemAdapter } from "./adapters/mock/mock-external-system.adapter";
import { mockOTAAdapter } from "./adapters/mock/mock-ota.adapter";

/**
 * Single place that decides which adapter backs each port. Every AI
 * employee calls these factory functions instead of importing an adapter
 * directly — swapping mock → real integration later is "add
 * adapters/instagram-graph-api.adapter.ts, change one return statement
 * here," with zero changes to any employee's logic.
 */
export function getSocialResearchConnector(): SocialResearchConnector {
  return mockSocialResearchAdapter;
}

export function getTrendConnector(): TrendConnector {
  return mockTrendAdapter;
}

export function getMetaAdsConnector(): MetaAdsConnector {
  return mockMetaAdsAdapter;
}

export function getExternalSystemConnector(): ExternalSystemConnector {
  return mockExternalSystemAdapter;
}

export function getOTAConnector(): OTAConnector {
  return mockOTAAdapter;
}
