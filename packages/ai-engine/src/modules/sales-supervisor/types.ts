export type RepStatus = "achieved" | "on_track" | "lagging";

export interface RepProgress {
  repId: string;
  name: string;
  branch: string;
  targetIdr: number;
  achievedIdr: number;
  progressPct: number;
  status: RepStatus;
  lastActivityDaysAgo: number;
  followUpRecommendation?: string;
}

export interface SalesSupervisionData {
  periodLabel: string;
  overallProgressPct: number;
  reps: RepProgress[];
  laggingReps: RepProgress[];
}
