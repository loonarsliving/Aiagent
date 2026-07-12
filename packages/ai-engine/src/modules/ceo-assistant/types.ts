export interface ExecutiveSummaryData {
  periodLabel: string;
  sales: {
    headline: string;
    overallProgressPct: number;
    laggingCount: number;
    totalReps: number;
  };
  marketing: {
    headline: string;
    dailyRecommendation: string;
  };
  metaAds: {
    headline: string;
    actionableCount: number;
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
  decisionsNeeded: string[];
}
