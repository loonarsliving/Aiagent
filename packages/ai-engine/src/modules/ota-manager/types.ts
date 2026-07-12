export type PricingAction = "increase" | "decrease" | "hold";

export interface OTAPropertyAnalysis {
  propertyId: string;
  propertyName: string;
  occupancyPct: number;
  adrIdr: number;
  competitorAvgPriceIdr: number;
  bookingPaceIndex: number;
  currentDynamicPriceIdr: number;
  recommendedDynamicPriceIdr: number;
  pricingAction: PricingAction;
  reason: string;
}

export interface OTAManagerData {
  periodLabel: string;
  properties: OTAPropertyAnalysis[];
  propertiesNeedingAction: string[];
}

export interface WeeklyOTATrend {
  periodLabel: string;
  daysAggregated: number;
  propertyTrends: { propertyName: string; avgOccupancyPct: number; trend: "improving" | "flat" | "declining" }[];
}

export interface MonthlyOTARecap {
  periodLabel: string;
  daysAggregated: number;
  note: string;
  propertySummaries: { propertyName: string; finalOccupancyPct: number }[];
}
