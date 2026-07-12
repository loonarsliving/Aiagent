import type { MarketTrendSignal, TrendCategory } from "../types";

/** Broader market trend research — Google Trends today, whatever trend source is added later keeps this same shape. */
export interface TrendConnector {
  getTrends(category: TrendCategory): Promise<MarketTrendSignal[]>;
}
