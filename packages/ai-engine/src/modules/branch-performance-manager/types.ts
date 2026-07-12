export type BranchStatus = "healthy" | "needs_attention" | "critical";

export interface BranchPerformance {
  branch: string;
  totalTargetIdr: number;
  totalAchievedIdr: number;
  progressPct: number;
  repCount: number;
  avgLastActivityDaysAgo: number;
  status: BranchStatus;
  /** Addressed to the Kepala Cabang of this specific branch. */
  recommendation: string;
}

export interface BranchPerformanceData {
  periodLabel: string;
  branches: BranchPerformance[];
  branchesNeedingAttention: string[];
}

export interface WeeklyBranchTrend {
  periodLabel: string;
  daysAggregated: number;
  branchTrends: { branch: string; avgProgressPct: number; trend: "improving" | "flat" | "declining" }[];
}

export interface MonthlyBranchRecap {
  periodLabel: string;
  daysAggregated: number;
  note: string;
  branchSummaries: { branch: string; finalProgressPct: number }[];
}
