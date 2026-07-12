import type { FinanceTransaction } from "@mkh/database";
import type { FinanceAnalysisData, TransactionAnomaly } from "./types";

/**
 * Anomaly rule: an expense/income is flagged when it's materially larger
 * than the average of *other* transactions in the same category — simple
 * and explainable to a non-technical Owner ("2x lipat rata-rata kategori
 * ini"). A category needs at least 2 transactions to have a baseline.
 * Chosen over z-score because our transaction volume per category is small
 * (single digits), where z-score is unstable; revisit once real ERP volume
 * is available.
 */
export const ANOMALY_MULTIPLIER = 1.8;
export const ANOMALY_MIN_DELTA_IDR = 50_000_000;

export function detectAnomalies(transactions: FinanceTransaction[]): TransactionAnomaly[] {
  const byCategory = new Map<string, FinanceTransaction[]>();
  for (const txn of transactions) {
    const list = byCategory.get(txn.category) ?? [];
    list.push(txn);
    byCategory.set(txn.category, list);
  }

  const anomalies: TransactionAnomaly[] = [];
  for (const [category, txns] of byCategory) {
    if (txns.length < 2) continue;
    for (const txn of txns) {
      const others = txns.filter((t) => t.id !== txn.id);
      const avgOthers = others.reduce((sum, t) => sum + t.amountIdr, 0) / others.length;
      const delta = txn.amountIdr - avgOthers;
      if (txn.amountIdr > avgOthers * ANOMALY_MULTIPLIER && delta >= ANOMALY_MIN_DELTA_IDR) {
        anomalies.push({
          transactionId: txn.id,
          category,
          amountIdr: txn.amountIdr,
          description: txn.description,
          reasonFlagged: `Rp${txn.amountIdr.toLocaleString("id-ID")} vs rata-rata kategori "${category}" Rp${Math.round(avgOthers).toLocaleString("id-ID")} (>${ANOMALY_MULTIPLIER}x).`,
        });
      }
    }
  }
  return anomalies;
}

export function projectCashflowNext7Days(transactions: FinanceTransaction[]): number {
  if (transactions.length === 0) return 0;
  const dates = transactions.map((t) => t.date).sort();
  const spanDays = Math.max(1, dayDiff(dates[0]!, dates[dates.length - 1]!) + 1);
  const net = transactions.reduce((sum, t) => sum + (t.type === "income" ? t.amountIdr : -t.amountIdr), 0);
  const avgDailyNet = net / spanDays;
  return Math.round(avgDailyNet * 7);
}

function dayDiff(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

export function buildFinanceAnalysis(periodLabel: string, transactions: FinanceTransaction[]): FinanceAnalysisData {
  const totalIncomeIdr = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amountIdr, 0);
  const totalExpenseIdr = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amountIdr, 0);

  return {
    periodLabel,
    totalIncomeIdr,
    totalExpenseIdr,
    netCashflowIdr: totalIncomeIdr - totalExpenseIdr,
    cashflowProjectionNext7dIdr: projectCashflowNext7Days(transactions),
    anomalies: detectAnomalies(transactions),
  };
}
