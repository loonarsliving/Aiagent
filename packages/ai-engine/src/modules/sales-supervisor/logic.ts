import type { SalesRepProgress } from "@mkh/database";
import type { AIReport } from "@mkh/shared";
import type { MonthlyTargetRecap, RepProgress, RepStatus, SalesSupervisionData, WeeklyPaceCheck } from "./types";

export const LAGGING_PROGRESS_THRESHOLD_PCT = 60;
export const LAGGING_INACTIVITY_DAYS = 4;

export function classifyRep(progressPct: number, lastActivityDaysAgo: number): RepStatus {
  if (progressPct >= 100) return "achieved";
  if (progressPct < LAGGING_PROGRESS_THRESHOLD_PCT || lastActivityDaysAgo >= LAGGING_INACTIVITY_DAYS) {
    return "lagging";
  }
  return "on_track";
}

export function followUpFor(rep: SalesRepProgress, progressPct: number): string | undefined {
  if (progressPct >= 100) return undefined;
  const gapIdr = rep.targetIdr - rep.achievedIdr;
  if (rep.lastActivityDaysAgo >= LAGGING_INACTIVITY_DAYS) {
    return `${rep.name} belum ada aktivitas selama ${rep.lastActivityDaysAgo} hari — follow-up ke prospek existing sebelum leads baru datang. Kekurangan target: Rp${gapIdr.toLocaleString("id-ID")}.`;
  }
  if (progressPct < LAGGING_PROGRESS_THRESHOLD_PCT) {
    return `${rep.name} baru capai ${progressPct.toFixed(0)}% target. Prioritaskan follow-up leads Meta Ads terbaru, kekurangan Rp${gapIdr.toLocaleString("id-ID")}.`;
  }
  return undefined;
}

export function buildRepProgress(rep: SalesRepProgress): RepProgress {
  const progressPct = rep.targetIdr > 0 ? Number(((rep.achievedIdr / rep.targetIdr) * 100).toFixed(1)) : 0;
  const status = classifyRep(progressPct, rep.lastActivityDaysAgo);
  return {
    repId: rep.repId,
    name: rep.name,
    branch: rep.branch,
    targetIdr: rep.targetIdr,
    achievedIdr: rep.achievedIdr,
    progressPct,
    status,
    lastActivityDaysAgo: rep.lastActivityDaysAgo,
    followUpRecommendation: status === "lagging" ? followUpFor(rep, progressPct) : undefined,
  };
}

export function buildSupervisionData(periodLabel: string, reps: SalesRepProgress[]): SalesSupervisionData {
  const progress = reps.map(buildRepProgress);
  const totalTarget = reps.reduce((sum, r) => sum + r.targetIdr, 0);
  const totalAchieved = reps.reduce((sum, r) => sum + r.achievedIdr, 0);
  const overallProgressPct = totalTarget > 0 ? Number(((totalAchieved / totalTarget) * 100).toFixed(1)) : 0;

  return {
    periodLabel,
    overallProgressPct,
    reps: progress,
    laggingReps: progress.filter((r) => r.status === "lagging"),
  };
}

export function buildWeeklyPaceCheck(periodLabel: string, dailyReports: AIReport<SalesSupervisionData>[]): WeeklyPaceCheck {
  if (dailyReports.length === 0) {
    return { periodLabel, daysAggregated: 0, avgOverallProgressPct: 0, progressTrend: "flat", chronicLaggards: [] };
  }

  const avgOverallProgressPct = Number(
    (dailyReports.reduce((sum, r) => sum + (r.data?.overallProgressPct ?? 0), 0) / dailyReports.length).toFixed(1),
  );

  const first = dailyReports[0]!.data?.overallProgressPct ?? 0;
  const last = dailyReports[dailyReports.length - 1]!.data?.overallProgressPct ?? 0;
  const delta = last - first;
  const progressTrend = delta > 1 ? "improving" : delta < -1 ? "declining" : "flat";

  const laggingCounts = new Map<string, number>();
  for (const report of dailyReports) {
    for (const rep of report.data?.laggingReps ?? []) {
      laggingCounts.set(rep.name, (laggingCounts.get(rep.name) ?? 0) + 1);
    }
  }
  const chronicLaggards = Array.from(laggingCounts.entries())
    .filter(([, count]) => count > dailyReports.length / 2)
    .map(([name]) => name);

  return { periodLabel, daysAggregated: dailyReports.length, avgOverallProgressPct, progressTrend, chronicLaggards };
}

export function buildMonthlyTargetRecap(periodLabel: string, dailyReports: AIReport<SalesSupervisionData>[]): MonthlyTargetRecap {
  const finalOverallProgressPct = dailyReports.length > 0 ? dailyReports[dailyReports.length - 1]!.data?.overallProgressPct ?? 0 : 0;
  const totalLaggingIncidents = dailyReports.reduce((sum, r) => sum + (r.data?.laggingReps.length ?? 0), 0);

  const note =
    dailyReports.length === 0
      ? "Belum ada laporan harian bulan ini untuk direkap."
      : `Progress akhir bulan ${finalOverallProgressPct}%, tercatat ${totalLaggingIncidents} insiden keterlambatan follow-up sepanjang bulan.`;

  return { periodLabel, daysAggregated: dailyReports.length, finalOverallProgressPct, totalLaggingIncidents, note };
}
