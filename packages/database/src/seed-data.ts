import type { ScheduleEntry } from "@mkh/shared";
import type { FinanceSnapshot, MarkomChecklistCompletionState, SalesSnapshot } from "./domain-types";

/**
 * Every employee's Daily + Weekly + Monthly slots. Weekly runs Monday
 * (dayOfWeek=1), monthly runs the 1st (dayOfMonth=1) — arbitrary but
 * consistent choices, easy to change per employee later without touching
 * scheduler code (see packages/scheduler/src/cron-expression.ts).
 */
export const DEFAULT_SCHEDULE: ScheduleEntry[] = [
  // Daily
  { id: "sch_mi_daily", moduleId: "marketing-intelligence", cadence: "daily", time: "06:00", label: "Marketing Intelligence — Daily Research", enabled: true },
  { id: "sch_mo_daily", moduleId: "marketing-operation", cadence: "daily", time: "07:30", label: "Marketing Operation — Daily Checklist & Reminders", enabled: true },
  { id: "sch_ma_daily", moduleId: "meta-ads-operator", cadence: "daily", time: "08:00", label: "Meta Ads AI — Daily Campaign Analysis", enabled: true },
  { id: "sch_ss_daily", moduleId: "sales-supervisor", cadence: "daily", time: "12:00", label: "Sales Supervisor — Daily Progress", enabled: true },
  { id: "sch_fa_daily", moduleId: "finance-analyst", cadence: "daily", time: "15:00", label: "Finance Analyst — Daily Analysis", enabled: true },
  { id: "sch_ceo_daily", moduleId: "ceo-assistant", cadence: "daily", time: "18:00", label: "CEO Assistant — Daily Executive Summary", enabled: true },

  // Weekly (Monday)
  { id: "sch_mi_weekly", moduleId: "marketing-intelligence", cadence: "weekly", time: "06:30", dayOfWeek: 1, label: "Marketing Intelligence — Weekly Strategy", enabled: true },
  { id: "sch_mo_weekly", moduleId: "marketing-operation", cadence: "weekly", time: "07:45", dayOfWeek: 1, label: "Marketing Operation — Weekly Checklist Rebuild", enabled: true },
  { id: "sch_ma_weekly", moduleId: "meta-ads-operator", cadence: "weekly", time: "09:00", dayOfWeek: 1, label: "Meta Ads AI — Weekly Campaign Comparison", enabled: true },
  { id: "sch_ss_weekly", moduleId: "sales-supervisor", cadence: "weekly", time: "12:30", dayOfWeek: 1, label: "Sales Supervisor — Weekly Pace Check", enabled: true },
  { id: "sch_fa_weekly", moduleId: "finance-analyst", cadence: "weekly", time: "15:30", dayOfWeek: 1, label: "Finance Analyst — Weekly Summary", enabled: true },
  { id: "sch_ceo_weekly", moduleId: "ceo-assistant", cadence: "weekly", time: "18:30", dayOfWeek: 1, label: "CEO Assistant — Weekly Rollup", enabled: true },

  // Monthly (1st of month)
  { id: "sch_mi_monthly", moduleId: "marketing-intelligence", cadence: "monthly", time: "06:00", dayOfMonth: 1, label: "Marketing Intelligence — Monthly Knowledge Base Retrospective", enabled: true },
  { id: "sch_mo_monthly", moduleId: "marketing-operation", cadence: "monthly", time: "07:30", dayOfMonth: 1, label: "Marketing Operation — Monthly Completion Recap", enabled: true },
  { id: "sch_ma_monthly", moduleId: "meta-ads-operator", cadence: "monthly", time: "08:00", dayOfMonth: 1, label: "Meta Ads AI — Monthly Ads Recap", enabled: true },
  { id: "sch_ss_monthly", moduleId: "sales-supervisor", cadence: "monthly", time: "12:00", dayOfMonth: 1, label: "Sales Supervisor — Monthly Target Recap", enabled: true },
  { id: "sch_fa_monthly", moduleId: "finance-analyst", cadence: "monthly", time: "15:00", dayOfMonth: 1, label: "Finance Analyst — Monthly Financial Report", enabled: true },
  { id: "sch_ceo_monthly", moduleId: "ceo-assistant", cadence: "monthly", time: "19:00", dayOfMonth: 1, label: "CEO Assistant — Monthly Board Report", enabled: true },
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

/** Markom has finished Senin & Selasa's checklist items; Rabu-Minggu still pending — gives Marketing Operation's reminder logic something real to flag. */
export function seedMarkomChecklistCompletionState(): MarkomChecklistCompletionState {
  return {
    asOf: new Date().toISOString(),
    completedDayIndexes: [0, 1],
  };
}
