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
