/**
 * "Internal system of record" data — the shape sales/finance data would take
 * once synced from the real ERP (eventually via MK Connect). For now these
 * are served as seeded fixtures by InMemoryRepository.
 */

export interface SalesRepProgress {
  repId: string;
  name: string;
  branch: string;
  targetIdr: number;
  achievedIdr: number;
  lastActivityDaysAgo: number;
}

export interface SalesSnapshot {
  asOf: string;
  periodLabel: string;
  reps: SalesRepProgress[];
}

export type FinanceTransactionType = "income" | "expense";

export interface FinanceTransaction {
  id: string;
  date: string;
  type: FinanceTransactionType;
  category: string;
  amountIdr: number;
  description: string;
}

export interface FinanceSnapshot {
  asOf: string;
  transactions: FinanceTransaction[];
}
