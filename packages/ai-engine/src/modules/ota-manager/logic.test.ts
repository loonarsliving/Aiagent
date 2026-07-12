import { describe, expect, it } from "vitest";
import type { OTAPropertySnapshot } from "@mkh/connectors";
import type { AIReport } from "@mkh/shared";
import {
  buildMonthlyOTARecap,
  buildOTAManagerData,
  buildOTAPropertyAnalysis,
  buildWeeklyOTATrend,
  recommendPricing,
} from "./logic";
import type { OTAManagerData } from "./types";

function snapshot(overrides: Partial<OTAPropertySnapshot> = {}): OTAPropertySnapshot {
  return {
    propertyId: "villa_test",
    propertyName: "Villa Test",
    date: "2026-07-12",
    roomsTotal: 10,
    roomsBooked: 5,
    occupancyPct: 50,
    adrIdr: 800_000,
    competitorAvgPriceIdr: 800_000,
    bookingPaceIndex: 100,
    currentDynamicPriceIdr: 800_000,
    ...overrides,
  };
}

describe("recommendPricing", () => {
  it("recommends increasing price when occupancy is high and booking pace is fast", () => {
    const result = recommendPricing(snapshot({ occupancyPct: 90, bookingPaceIndex: 120, currentDynamicPriceIdr: 800_000 }));
    expect(result.pricingAction).toBe("increase");
    expect(result.recommendedDynamicPriceIdr).toBeGreaterThan(800_000);
  });

  it("recommends decreasing price when occupancy is low and booking pace is slow", () => {
    const result = recommendPricing(snapshot({ occupancyPct: 30, bookingPaceIndex: 60, currentDynamicPriceIdr: 800_000, competitorAvgPriceIdr: 700_000 }));
    expect(result.pricingAction).toBe("decrease");
    expect(result.recommendedDynamicPriceIdr).toBeLessThan(800_000);
  });

  it("recommends holding price when metrics are in the normal range", () => {
    const result = recommendPricing(snapshot({ occupancyPct: 70, bookingPaceIndex: 95, currentDynamicPriceIdr: 800_000 }));
    expect(result.pricingAction).toBe("hold");
    expect(result.recommendedDynamicPriceIdr).toBe(800_000);
  });
});

describe("buildOTAPropertyAnalysis", () => {
  it("carries through the raw snapshot fields plus the pricing recommendation", () => {
    const analysis = buildOTAPropertyAnalysis(snapshot({ occupancyPct: 90, bookingPaceIndex: 120 }));
    expect(analysis.propertyName).toBe("Villa Test");
    expect(analysis.pricingAction).toBe("increase");
    expect(analysis.reason).toBeTruthy();
  });
});

describe("buildOTAManagerData", () => {
  it("flags only the properties whose pricing action is not hold", () => {
    const data = buildOTAManagerData("Hari ini", [
      snapshot({ propertyId: "a", propertyName: "A", occupancyPct: 90, bookingPaceIndex: 120 }),
      snapshot({ propertyId: "b", propertyName: "B", occupancyPct: 70, bookingPaceIndex: 95 }),
    ]);
    expect(data.properties).toHaveLength(2);
    expect(data.propertiesNeedingAction).toEqual(["A"]);
  });
});

function report(data: OTAManagerData): AIReport<OTAManagerData> {
  return {
    id: "rpt_x",
    moduleId: "ota-manager",
    cadence: "daily",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: "test",
    data,
  };
}

describe("buildWeeklyOTATrend", () => {
  it("detects an improving occupancy trend per property across the week", () => {
    const day1 = buildOTAManagerData("d1", [snapshot({ occupancyPct: 40 })]);
    const day2 = buildOTAManagerData("d2", [snapshot({ occupancyPct: 80 })]);
    const trend = buildWeeklyOTATrend("7 hari terakhir", [report(day1), report(day2)]);
    expect(trend.propertyTrends[0]?.trend).toBe("improving");
  });

  it("handles no daily reports gracefully", () => {
    const trend = buildWeeklyOTATrend("7 hari terakhir", []);
    expect(trend.daysAggregated).toBe(0);
    expect(trend.propertyTrends).toEqual([]);
  });
});

describe("buildMonthlyOTARecap", () => {
  it("summarizes the final day's occupancy per property", () => {
    const dailyReports = [report(buildOTAManagerData("d1", [snapshot({ occupancyPct: 77 })]))];
    const recap = buildMonthlyOTARecap("Bulan ini", dailyReports);
    expect(recap.propertySummaries).toHaveLength(1);
    expect(recap.propertySummaries[0]?.finalOccupancyPct).toBe(77);
  });

  it("notes when there is nothing to recap", () => {
    const recap = buildMonthlyOTARecap("Bulan ini", []);
    expect(recap.daysAggregated).toBe(0);
    expect(recap.propertySummaries).toEqual([]);
  });
});
