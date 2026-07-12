import type { SalesRepProgress } from "@mkh/database";
import type { AIReport } from "@mkh/shared";
import type { BranchPerformance, BranchPerformanceData, BranchStatus, MonthlyBranchRecap, WeeklyBranchTrend } from "./types";

export const CRITICAL_PROGRESS_THRESHOLD_PCT = 50;
export const NEEDS_ATTENTION_PROGRESS_THRESHOLD_PCT = 75;
export const NEEDS_ATTENTION_ACTIVITY_DAYS = 3;

/**
 * Groups reps by whatever branch names exist in the data — no hardcoded
 * branch list. "Setiap cabang mempunyai AI sendiri" is satisfied by this
 * being fully data-driven: adding a new branch to the seed/ERP data
 * automatically gets its own section in the next report, no code change.
 */
export function groupByBranch(reps: SalesRepProgress[]): Map<string, SalesRepProgress[]> {
  const groups = new Map<string, SalesRepProgress[]>();
  for (const rep of reps) {
    const list = groups.get(rep.branch) ?? [];
    list.push(rep);
    groups.set(rep.branch, list);
  }
  return groups;
}

export function classifyBranch(progressPct: number, avgActivityDaysAgo: number): BranchStatus {
  if (progressPct < CRITICAL_PROGRESS_THRESHOLD_PCT) return "critical";
  if (progressPct < NEEDS_ATTENTION_PROGRESS_THRESHOLD_PCT || avgActivityDaysAgo >= NEEDS_ATTENTION_ACTIVITY_DAYS) {
    return "needs_attention";
  }
  return "healthy";
}

export function buildRecommendation(branch: string, status: BranchStatus, progressPct: number, repCount: number): string {
  if (status === "critical") {
    return `Kepala Cabang ${branch}: progress cabang baru ${progressPct.toFixed(0)}% dari target dengan ${repCount} sales — perlu evaluasi menyeluruh (coaching intensif, tinjau alokasi leads) minggu ini.`;
  }
  if (status === "needs_attention") {
    return `Kepala Cabang ${branch}: progress ${progressPct.toFixed(0)}%, ada indikasi aktivitas follow-up melambat — pantau closing 1-2 sales yang paling tertinggal.`;
  }
  return `Kepala Cabang ${branch}: performa sehat (${progressPct.toFixed(0)}%) — pertahankan ritme, dorong sales top performer untuk mentoring rekan lain.`;
}

export function buildBranchPerformance(branch: string, reps: SalesRepProgress[]): BranchPerformance {
  const totalTargetIdr = reps.reduce((sum, r) => sum + r.targetIdr, 0);
  const totalAchievedIdr = reps.reduce((sum, r) => sum + r.achievedIdr, 0);
  const progressPct = totalTargetIdr > 0 ? Number(((totalAchievedIdr / totalTargetIdr) * 100).toFixed(1)) : 0;
  const avgLastActivityDaysAgo = reps.length > 0 ? Number((reps.reduce((sum, r) => sum + r.lastActivityDaysAgo, 0) / reps.length).toFixed(1)) : 0;
  const status = classifyBranch(progressPct, avgLastActivityDaysAgo);

  return {
    branch,
    totalTargetIdr,
    totalAchievedIdr,
    progressPct,
    repCount: reps.length,
    avgLastActivityDaysAgo,
    status,
    recommendation: buildRecommendation(branch, status, progressPct, reps.length),
  };
}

export function buildBranchPerformanceData(periodLabel: string, reps: SalesRepProgress[]): BranchPerformanceData {
  const groups = groupByBranch(reps);
  const branches = Array.from(groups.entries())
    .map(([branch, branchReps]) => buildBranchPerformance(branch, branchReps))
    .sort((a, b) => a.progressPct - b.progressPct);

  return {
    periodLabel,
    branches,
    branchesNeedingAttention: branches.filter((b) => b.status !== "healthy").map((b) => b.branch),
  };
}

export function buildWeeklyBranchTrend(periodLabel: string, dailyReports: AIReport<BranchPerformanceData>[]): WeeklyBranchTrend {
  const byBranch = new Map<string, number[]>();
  for (const report of dailyReports) {
    for (const b of report.data?.branches ?? []) {
      const list = byBranch.get(b.branch) ?? [];
      list.push(b.progressPct);
      byBranch.set(b.branch, list);
    }
  }

  const branchTrends = Array.from(byBranch.entries()).map(([branch, values]) => {
    const avgProgressPct = Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(1));
    const delta = (values[values.length - 1] ?? 0) - (values[0] ?? 0);
    const trend = delta > 1 ? "improving" : delta < -1 ? "declining" : "flat";
    return { branch, avgProgressPct, trend: trend as "improving" | "flat" | "declining" };
  });

  return { periodLabel, daysAggregated: dailyReports.length, branchTrends };
}

export function buildMonthlyBranchRecap(periodLabel: string, dailyReports: AIReport<BranchPerformanceData>[]): MonthlyBranchRecap {
  if (dailyReports.length === 0) {
    return { periodLabel, daysAggregated: 0, note: "Belum ada laporan harian bulan ini untuk direkap.", branchSummaries: [] };
  }
  const last = dailyReports[dailyReports.length - 1]!;
  const branchSummaries = (last.data?.branches ?? []).map((b) => ({ branch: b.branch, finalProgressPct: b.progressPct }));

  return {
    periodLabel,
    daysAggregated: dailyReports.length,
    note: `Rekap akhir bulan untuk ${branchSummaries.length} cabang.`,
    branchSummaries,
  };
}
