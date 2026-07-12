import type { OTAPropertySnapshot } from "@mkh/connectors";
import type { AIReport } from "@mkh/shared";
import type { MonthlyOTARecap, OTAManagerData, OTAPropertyAnalysis, PricingAction, WeeklyOTATrend } from "./types";

export const HIGH_OCCUPANCY_THRESHOLD_PCT = 85;
export const LOW_OCCUPANCY_THRESHOLD_PCT = 50;
export const FAST_BOOKING_PACE_INDEX = 110;
export const SLOW_BOOKING_PACE_INDEX = 80;
export const PRICE_ADJUSTMENT_PCT = 5;

/** Dynamic pricing recommendation — occupancy + booking pace decide direction; competitor price bounds the magnitude. */
export function recommendPricing(
  snapshot: OTAPropertySnapshot,
): { recommendedDynamicPriceIdr: number; pricingAction: PricingAction; reason: string } {
  const { occupancyPct, bookingPaceIndex, currentDynamicPriceIdr, competitorAvgPriceIdr } = snapshot;

  if (occupancyPct >= HIGH_OCCUPANCY_THRESHOLD_PCT && bookingPaceIndex >= FAST_BOOKING_PACE_INDEX) {
    const raised = Math.round(currentDynamicPriceIdr * (1 + PRICE_ADJUSTMENT_PCT / 100));
    return {
      recommendedDynamicPriceIdr: raised,
      pricingAction: "increase",
      reason: `Okupansi ${occupancyPct}% dan booking pace ${bookingPaceIndex} (di atas normal) — naikkan harga ${PRICE_ADJUSTMENT_PCT}% untuk memaksimalkan revenue selama permintaan tinggi.`,
    };
  }

  if (occupancyPct <= LOW_OCCUPANCY_THRESHOLD_PCT && bookingPaceIndex <= SLOW_BOOKING_PACE_INDEX) {
    const lowered = Math.min(Math.round(currentDynamicPriceIdr * (1 - PRICE_ADJUSTMENT_PCT / 100)), competitorAvgPriceIdr);
    return {
      recommendedDynamicPriceIdr: lowered,
      pricingAction: "decrease",
      reason: `Okupansi ${occupancyPct}% dan booking pace ${bookingPaceIndex} (di bawah normal) — turunkan harga mendekati rata-rata kompetitor (Rp${competitorAvgPriceIdr.toLocaleString("id-ID")}) untuk mendorong booking.`,
    };
  }

  return {
    recommendedDynamicPriceIdr: currentDynamicPriceIdr,
    pricingAction: "hold",
    reason: `Okupansi ${occupancyPct}% dan booking pace ${bookingPaceIndex} masih dalam rentang normal — pertahankan harga saat ini.`,
  };
}

export function buildOTAPropertyAnalysis(snapshot: OTAPropertySnapshot): OTAPropertyAnalysis {
  const { recommendedDynamicPriceIdr, pricingAction, reason } = recommendPricing(snapshot);

  return {
    propertyId: snapshot.propertyId,
    propertyName: snapshot.propertyName,
    occupancyPct: snapshot.occupancyPct,
    adrIdr: snapshot.adrIdr,
    competitorAvgPriceIdr: snapshot.competitorAvgPriceIdr,
    bookingPaceIndex: snapshot.bookingPaceIndex,
    currentDynamicPriceIdr: snapshot.currentDynamicPriceIdr,
    recommendedDynamicPriceIdr,
    pricingAction,
    reason,
  };
}

export function buildOTAManagerData(periodLabel: string, snapshots: OTAPropertySnapshot[]): OTAManagerData {
  const properties = snapshots.map(buildOTAPropertyAnalysis);
  return {
    periodLabel,
    properties,
    propertiesNeedingAction: properties.filter((p) => p.pricingAction !== "hold").map((p) => p.propertyName),
  };
}

export function buildWeeklyOTATrend(periodLabel: string, dailyReports: AIReport<OTAManagerData>[]): WeeklyOTATrend {
  const byProperty = new Map<string, number[]>();
  for (const report of dailyReports) {
    for (const p of report.data?.properties ?? []) {
      const list = byProperty.get(p.propertyName) ?? [];
      list.push(p.occupancyPct);
      byProperty.set(p.propertyName, list);
    }
  }

  const propertyTrends = Array.from(byProperty.entries()).map(([propertyName, values]) => {
    const avgOccupancyPct = Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(1));
    const delta = (values[values.length - 1] ?? 0) - (values[0] ?? 0);
    const trend = delta > 1 ? "improving" : delta < -1 ? "declining" : "flat";
    return { propertyName, avgOccupancyPct, trend: trend as "improving" | "flat" | "declining" };
  });

  return { periodLabel, daysAggregated: dailyReports.length, propertyTrends };
}

export function buildMonthlyOTARecap(periodLabel: string, dailyReports: AIReport<OTAManagerData>[]): MonthlyOTARecap {
  if (dailyReports.length === 0) {
    return { periodLabel, daysAggregated: 0, note: "Belum ada laporan harian bulan ini untuk direkap.", propertySummaries: [] };
  }
  const last = dailyReports[dailyReports.length - 1]!;
  const propertySummaries = (last.data?.properties ?? []).map((p) => ({ propertyName: p.propertyName, finalOccupancyPct: p.occupancyPct }));

  return {
    periodLabel,
    daysAggregated: dailyReports.length,
    note: `Rekap akhir bulan untuk ${propertySummaries.length} properti.`,
    propertySummaries,
  };
}
