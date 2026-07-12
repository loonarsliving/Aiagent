export interface ExecutiveSummaryData {
  periodLabel: string;
  sales: {
    headline: string;
    overallProgressPct: number;
    laggingCount: number;
    totalReps: number;
  };
  marketingIntelligence: {
    headline: string;
    dailyRecommendation: string;
    newSignals: number;
  };
  marketingOperation: {
    headline: string;
    incompleteCount: number;
  };
  metaAds: {
    headline: string;
    actionableCount: number;
    proposedApprovalIds: string[];
  };
  finance: {
    headline: string;
    netCashflowIdr: number;
    cashflowProjectionNext7dIdr: number;
    anomalyCount: number;
  };
  property: {
    villaIncomeIdr: number;
    perumahanIncomeIdr: number;
  };
  /** Things the Owner should look at today — the "needs a decision or eyes on it" list. */
  attentionNeeded: string[];
  /** What the AI suggests doing about the items above. */
  recommendations: string[];
  /** What tomorrow's schedule should prioritize, based on today's findings. */
  tomorrowPriorities: string[];
}

export interface WeeklyExecutiveRollup {
  periodLabel: string;
  daysAggregated: number;
  avgSalesProgressPct: number;
  totalMetaAdsApprovalsProposed: number;
  totalFinanceAnomalies: number;
  topAttentionThemes: string[];
}

export interface MonthlyBoardReport {
  periodLabel: string;
  daysAggregated: number;
  summary: string;
  highlights: string[];
}
