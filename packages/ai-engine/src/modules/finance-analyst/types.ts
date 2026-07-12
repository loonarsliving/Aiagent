export interface TransactionAnomaly {
  transactionId: string;
  category: string;
  amountIdr: number;
  description: string;
  reasonFlagged: string;
}

export interface FinanceAnalysisData {
  periodLabel: string;
  totalIncomeIdr: number;
  totalExpenseIdr: number;
  netCashflowIdr: number;
  cashflowProjectionNext7dIdr: number;
  anomalies: TransactionAnomaly[];
}

export interface WeeklyFinancialSummary {
  periodLabel: string;
  daysAggregated: number;
  avgNetCashflowIdr: number;
  totalAnomaliesDetected: number;
  recurringAnomalyCategories: string[];
}

export interface MonthlyFinancialReport {
  periodLabel: string;
  daysAggregated: number;
  avgNetCashflowIdr: number;
  totalAnomaliesDetected: number;
  note: string;
}
