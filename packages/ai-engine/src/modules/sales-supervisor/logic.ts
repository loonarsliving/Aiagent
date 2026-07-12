import type { SalesRepProgress } from "@mkh/database";
import type { RepProgress, RepStatus, SalesSupervisionData } from "./types";

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
