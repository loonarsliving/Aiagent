import type { ScheduleEntry } from "@mkh/shared";
import type { FinanceSnapshot, SalesSnapshot } from "./domain-types";

export const DEFAULT_SCHEDULE: ScheduleEntry[] = [
  { id: "sch_marketing", moduleId: "marketing-strategist", time: "08:00", label: "Marketing AI", enabled: true },
  { id: "sch_meta_ads", moduleId: "meta-ads-operator", time: "09:00", label: "Meta Ads AI", enabled: true },
  { id: "sch_sales", moduleId: "sales-supervisor", time: "12:00", label: "Sales AI", enabled: true },
  { id: "sch_finance", moduleId: "finance-analyst", time: "15:00", label: "Finance AI", enabled: true },
  { id: "sch_ceo", moduleId: "ceo-assistant", time: "18:00", label: "CEO AI Report", enabled: true },
];

export function seedSalesSnapshot(): SalesSnapshot {
  return {
    asOf: new Date().toISOString(),
    periodLabel: "Juli 2026",
    reps: [
      { repId: "rep_01", name: "Andi Pratama", branch: "Kendari", targetIdr: 500_000_000, achievedIdr: 410_000_000, lastActivityDaysAgo: 1 },
      { repId: "rep_02", name: "Siti Rahma", branch: "Kendari", targetIdr: 500_000_000, achievedIdr: 275_000_000, lastActivityDaysAgo: 5 },
      { repId: "rep_03", name: "Budi Santoso", branch: "Makassar", targetIdr: 600_000_000, achievedIdr: 180_000_000, lastActivityDaysAgo: 9 },
      { repId: "rep_04", name: "Nur Aisyah", branch: "Makassar", targetIdr: 600_000_000, achievedIdr: 555_000_000, lastActivityDaysAgo: 0 },
      { repId: "rep_05", name: "Rizal Fahmi", branch: "Kendari", targetIdr: 450_000_000, achievedIdr: 300_000_000, lastActivityDaysAgo: 3 },
    ],
  };
}

export function seedFinanceSnapshot(): FinanceSnapshot {
  const today = new Date();
  const daysAgo = (n: number) => new Date(today.getTime() - n * 86_400_000).toISOString().slice(0, 10);
  return {
    asOf: today.toISOString(),
    transactions: [
      { id: "txn_01", date: daysAgo(1), type: "income", category: "Penjualan Villa", amountIdr: 320_000_000, description: "DP Villa Blok C-12" },
      { id: "txn_02", date: daysAgo(2), type: "expense", category: "Operasional", amountIdr: 45_000_000, description: "Gaji karyawan lapangan" },
      { id: "txn_03", date: daysAgo(3), type: "expense", category: "Marketing", amountIdr: 18_000_000, description: "Ads spend Meta & TikTok" },
      { id: "txn_04", date: daysAgo(4), type: "income", category: "Penjualan Perumahan", amountIdr: 210_000_000, description: "Pelunasan unit A-4" },
      { id: "txn_05", date: daysAgo(5), type: "expense", category: "Konstruksi", amountIdr: 175_000_000, description: "Material tahap 2" },
      { id: "txn_06", date: daysAgo(6), type: "expense", category: "Operasional", amountIdr: 210_000_000, description: "Pembelian alat berat (tidak rutin)" },
      { id: "txn_07", date: daysAgo(7), type: "income", category: "Penjualan Villa", amountIdr: 150_000_000, description: "DP Villa Blok D-3" },
      { id: "txn_08", date: daysAgo(9), type: "expense", category: "Operasional", amountIdr: 40_000_000, description: "Utilitas & maintenance" },
      { id: "txn_09", date: daysAgo(11), type: "income", category: "Penjualan Perumahan", amountIdr: 260_000_000, description: "DP unit B-9" },
      { id: "txn_10", date: daysAgo(13), type: "expense", category: "Marketing", amountIdr: 22_000_000, description: "Ads spend Meta & TikTok" },
    ],
  };
}
