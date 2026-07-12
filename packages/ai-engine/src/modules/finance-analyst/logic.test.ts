import { describe, expect, it } from "vitest";
import type { FinanceTransaction } from "@mkh/database";
import { buildFinanceAnalysis, detectAnomalies, projectCashflowNext7Days } from "./logic";

function txn(overrides: Partial<FinanceTransaction>): FinanceTransaction {
  return {
    id: "txn_test",
    date: "2026-07-01",
    type: "expense",
    category: "Operasional",
    amountIdr: 10_000_000,
    description: "test",
    ...overrides,
  };
}

describe("detectAnomalies", () => {
  it("flags a transaction that is far above the average of its category", () => {
    const transactions = [
      txn({ id: "t1", category: "Operasional", amountIdr: 45_000_000 }),
      txn({ id: "t2", category: "Operasional", amountIdr: 40_000_000 }),
      txn({ id: "t3", category: "Operasional", amountIdr: 210_000_000 }),
    ];
    const anomalies = detectAnomalies(transactions);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.transactionId).toBe("t3");
  });

  it("does not flag anything when all transactions in a category are similar", () => {
    const transactions = [
      txn({ id: "t1", category: "Marketing", amountIdr: 20_000_000 }),
      txn({ id: "t2", category: "Marketing", amountIdr: 22_000_000 }),
    ];
    expect(detectAnomalies(transactions)).toHaveLength(0);
  });

  it("skips categories with only a single transaction (no baseline to compare against)", () => {
    const transactions = [txn({ id: "t1", category: "Konstruksi", amountIdr: 999_000_000 })];
    expect(detectAnomalies(transactions)).toHaveLength(0);
  });
});

describe("projectCashflowNext7Days", () => {
  it("projects forward using the average daily net over the observed period", () => {
    const transactions = [
      txn({ id: "t1", date: "2026-07-01", type: "income", amountIdr: 14_000_000 }),
      txn({ id: "t2", date: "2026-07-08", type: "expense", amountIdr: 0 }),
    ];
    // span = 8 days, net = +14,000,000 -> avg daily = 1,750,000 -> *7 = 12,250,000
    expect(projectCashflowNext7Days(transactions)).toBe(12_250_000);
  });

  it("returns 0 for an empty transaction list", () => {
    expect(projectCashflowNext7Days([])).toBe(0);
  });
});

describe("buildFinanceAnalysis", () => {
  it("computes totals and net cashflow", () => {
    const transactions = [
      txn({ id: "t1", type: "income", amountIdr: 100_000_000 }),
      txn({ id: "t2", type: "expense", amountIdr: 40_000_000 }),
    ];
    const data = buildFinanceAnalysis("test period", transactions);
    expect(data.totalIncomeIdr).toBe(100_000_000);
    expect(data.totalExpenseIdr).toBe(40_000_000);
    expect(data.netCashflowIdr).toBe(60_000_000);
  });
});
