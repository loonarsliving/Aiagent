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

export interface WeeklyPaceCheck {
  periodLabel: string;
  daysAggregated: number;
  avgOverallProgressPct: number;
  progressTrend: "improving" | "flat" | "declining";
  chronicLaggards: string[];
}

export interface MonthlyTargetRecap {
  periodLabel: string;
  daysAggregated: number;
  finalOverallProgressPct: number;
  totalLaggingIncidents: number;
  note: string;
}
