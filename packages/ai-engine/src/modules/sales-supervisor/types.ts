export type RepStatus = "achieved" | "on_track" | "lagging";

/** "recovery" = jauh dari target, butuh strategi pemulihan. "scaling" = hampir mencapai target, butuh strategi scaling untuk melewati target. "none" = progress sehat, tidak perlu strategi khusus. */
export type StrategyType = "recovery" | "scaling" | "none";

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
  strategyType: StrategyType;
  /** The actual recommended strategy text — present whenever strategyType !== "none". */
  strategy?: string;
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
