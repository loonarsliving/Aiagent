import type { ScheduleEntry } from "@mkh/shared";
import type { FinanceSnapshot, HRSnapshot, MarkomChecklistCompletionState, SalesSnapshot } from "./domain-types";

/**
 * Every employee's Daily + Weekly + Monthly slots. Weekly runs Monday
 * (dayOfWeek=1), monthly runs the 1st (dayOfMonth=1) — arbitrary but
 * consistent choices, easy to change per employee later without touching
 * scheduler code (see packages/scheduler/src/cron-expression.ts).
 */
export const DEFAULT_SCHEDULE: ScheduleEntry[] = [
  // Daily — ordered so each employee's upstream data (Marketing Intelligence's
  // research, Sales Supervisor's progress, everyone else's reports) is fresh
  // by the time a downstream employee (Content Planner/Meta Ads, SOP Guardian,
  // CEO Assistant) reads it. CEO Assistant runs last; SOP Guardian runs right
  // before it so today's compliance check is already fresh for the summary.
  { id: "sch_mi_daily", moduleId: "marketing-intelligence", cadence: "daily", time: "06:00", label: "Marketing Intelligence — Daily Research", enabled: true },
  { id: "sch_cp_daily", moduleId: "content-planner", cadence: "daily", time: "07:30", label: "Content Planner — Daily Checklist & Reminders", enabled: true },
  { id: "sch_mas_daily", moduleId: "meta-ads-specialist", cadence: "daily", time: "08:00", label: "Meta Ads Specialist — Daily Campaign Analysis", enabled: true },
  { id: "sch_ss_daily", moduleId: "sales-supervisor", cadence: "daily", time: "12:00", label: "Sales Supervisor — Daily Progress", enabled: true },
  { id: "sch_bpm_daily", moduleId: "branch-performance-manager", cadence: "daily", time: "12:15", label: "Branch Performance Manager — Daily Branch Review", enabled: true },
  { id: "sch_fa_daily", moduleId: "finance-analyst", cadence: "daily", time: "15:00", label: "Finance Analyst — Daily Analysis", enabled: true },
  { id: "sch_hr_daily", moduleId: "hr-officer", cadence: "daily", time: "15:15", label: "HR Officer — Daily Attendance & KPI Review", enabled: true },
  { id: "sch_ota_daily", moduleId: "ota-manager", cadence: "daily", time: "15:30", label: "OTA Manager — Daily Occupancy & Pricing Review", enabled: true },
  { id: "sch_sop_daily", moduleId: "sop-guardian", cadence: "daily", time: "17:00", label: "SOP Guardian — Daily Compliance Check", enabled: true },
  { id: "sch_ceo_daily", moduleId: "ceo-assistant", cadence: "daily", time: "18:00", label: "CEO Assistant — Daily Executive Summary", enabled: true },

  // Weekly (Monday)
  { id: "sch_mi_weekly", moduleId: "marketing-intelligence", cadence: "weekly", time: "06:30", dayOfWeek: 1, label: "Marketing Intelligence — Weekly Strategy", enabled: true },
  { id: "sch_cp_weekly", moduleId: "content-planner", cadence: "weekly", time: "07:45", dayOfWeek: 1, label: "Content Planner — Weekly Checklist Rebuild", enabled: true },
  { id: "sch_mas_weekly", moduleId: "meta-ads-specialist", cadence: "weekly", time: "09:00", dayOfWeek: 1, label: "Meta Ads Specialist — Weekly Campaign Comparison", enabled: true },
  { id: "sch_ss_weekly", moduleId: "sales-supervisor", cadence: "weekly", time: "12:30", dayOfWeek: 1, label: "Sales Supervisor — Weekly Pace Check", enabled: true },
  { id: "sch_bpm_weekly", moduleId: "branch-performance-manager", cadence: "weekly", time: "12:45", dayOfWeek: 1, label: "Branch Performance Manager — Weekly Trend", enabled: true },
  { id: "sch_fa_weekly", moduleId: "finance-analyst", cadence: "weekly", time: "15:30", dayOfWeek: 1, label: "Finance Analyst — Weekly Summary", enabled: true },
  { id: "sch_hr_weekly", moduleId: "hr-officer", cadence: "weekly", time: "15:45", dayOfWeek: 1, label: "HR Officer — Weekly Trend", enabled: true },
  { id: "sch_ota_weekly", moduleId: "ota-manager", cadence: "weekly", time: "16:00", dayOfWeek: 1, label: "OTA Manager — Weekly Occupancy Trend", enabled: true },
  { id: "sch_sop_weekly", moduleId: "sop-guardian", cadence: "weekly", time: "17:30", dayOfWeek: 1, label: "SOP Guardian — Weekly Compliance Trend", enabled: true },
  { id: "sch_ceo_weekly", moduleId: "ceo-assistant", cadence: "weekly", time: "18:30", dayOfWeek: 1, label: "CEO Assistant — Weekly Rollup", enabled: true },

  // Monthly (1st of month)
  { id: "sch_mi_monthly", moduleId: "marketing-intelligence", cadence: "monthly", time: "06:00", dayOfMonth: 1, label: "Marketing Intelligence — Monthly Knowledge Base Retrospective", enabled: true },
  { id: "sch_cp_monthly", moduleId: "content-planner", cadence: "monthly", time: "07:30", dayOfMonth: 1, label: "Content Planner — Monthly Completion Recap", enabled: true },
  { id: "sch_mas_monthly", moduleId: "meta-ads-specialist", cadence: "monthly", time: "08:00", dayOfMonth: 1, label: "Meta Ads Specialist — Monthly Ads Recap", enabled: true },
  { id: "sch_ss_monthly", moduleId: "sales-supervisor", cadence: "monthly", time: "12:00", dayOfMonth: 1, label: "Sales Supervisor — Monthly Target Recap", enabled: true },
  { id: "sch_bpm_monthly", moduleId: "branch-performance-manager", cadence: "monthly", time: "12:30", dayOfMonth: 1, label: "Branch Performance Manager — Monthly Recap", enabled: true },
  { id: "sch_fa_monthly", moduleId: "finance-analyst", cadence: "monthly", time: "15:00", dayOfMonth: 1, label: "Finance Analyst — Monthly Financial Report", enabled: true },
  { id: "sch_hr_monthly", moduleId: "hr-officer", cadence: "monthly", time: "15:30", dayOfMonth: 1, label: "HR Officer — Monthly Recap", enabled: true },
  { id: "sch_ota_monthly", moduleId: "ota-manager", cadence: "monthly", time: "16:00", dayOfMonth: 1, label: "OTA Manager — Monthly Recap", enabled: true },
  { id: "sch_sop_monthly", moduleId: "sop-guardian", cadence: "monthly", time: "17:00", dayOfMonth: 1, label: "SOP Guardian — Monthly Compliance Recap", enabled: true },
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

export function seedHRSnapshot(): HRSnapshot {
  return {
    asOf: new Date().toISOString(),
    periodLabel: "Juli 2026",
    workingDaysInPeriod: 22,
    staff: [
      { staffId: "stf_01", name: "Andi Pratama", branch: "Kendari", role: "Sales", presentDays: 21, lateDays: 1, leaveDaysTaken: 1, leaveDaysQuota: 12, kpiScore: 88 },
      { staffId: "stf_02", name: "Siti Rahma", branch: "Kendari", role: "Sales", presentDays: 16, lateDays: 5, leaveDaysTaken: 2, leaveDaysQuota: 12, kpiScore: 58 },
      { staffId: "stf_03", name: "Budi Santoso", branch: "Makassar", role: "Sales", presentDays: 18, lateDays: 4, leaveDaysTaken: 3, leaveDaysQuota: 12, kpiScore: 62 },
      { staffId: "stf_04", name: "Nur Aisyah", branch: "Makassar", role: "Sales", presentDays: 22, lateDays: 0, leaveDaysTaken: 0, leaveDaysQuota: 12, kpiScore: 95 },
      { staffId: "stf_05", name: "Rizal Fahmi", branch: "Kendari", role: "Marketing", presentDays: 20, lateDays: 2, leaveDaysTaken: 1, leaveDaysQuota: 12, kpiScore: 79 },
      { staffId: "stf_06", name: "Dewi Kartika", branch: "Makassar", role: "Finance", presentDays: 22, lateDays: 0, leaveDaysTaken: 1, leaveDaysQuota: 12, kpiScore: 90 },
      { staffId: "stf_07", name: "Fajar Ramadhan", branch: "Kendari", role: "Operasional", presentDays: 14, lateDays: 6, leaveDaysTaken: 4, leaveDaysQuota: 12, kpiScore: 45 },
    ],
  };
}
