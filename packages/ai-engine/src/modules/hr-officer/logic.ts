import type { StaffAttendanceRecord } from "@mkh/database";
import type { AIReport } from "@mkh/shared";
import type { HRAnalysisData, HRIssueType, HRStaffFlag, MonthlyHRRecap, WeeklyHRTrend } from "./types";

export const LATE_DAYS_WARNING_THRESHOLD = 3;
export const ATTENDANCE_RATE_WARNING_PCT = 80;
export const LOW_KPI_THRESHOLD = 65;

export function computeAttendanceRatePct(staff: StaffAttendanceRecord, workingDaysInPeriod: number): number {
  if (workingDaysInPeriod <= 0) return 0;
  return Number(((staff.presentDays / workingDaysInPeriod) * 100).toFixed(1));
}

export function detectIssues(staff: StaffAttendanceRecord, attendanceRatePct: number): HRIssueType[] {
  const issues: HRIssueType[] = [];
  if (staff.lateDays >= LATE_DAYS_WARNING_THRESHOLD) issues.push("keterlambatan");
  if (attendanceRatePct < ATTENDANCE_RATE_WARNING_PCT) issues.push("kehadiran_rendah");
  if (staff.leaveDaysTaken > staff.leaveDaysQuota) issues.push("cuti_melebihi_kuota");
  if (staff.kpiScore < LOW_KPI_THRESHOLD) issues.push("kpi_rendah");
  return issues;
}

const ISSUE_LABEL: Record<HRIssueType, string> = {
  keterlambatan: "sering terlambat",
  kehadiran_rendah: "tingkat kehadiran rendah",
  cuti_melebihi_kuota: "cuti melebihi kuota",
  kpi_rendah: "KPI di bawah standar",
};

export function coachingRecommendationFor(staff: StaffAttendanceRecord, issues: HRIssueType[]): string {
  const labels = issues.map((i) => ISSUE_LABEL[i]).join(", ");
  return `${staff.name} (${staff.branch}) — ${labels}. Rekomendasi: jadwalkan sesi coaching 1-on-1 minggu ini, tinjau beban kerja dan kendala yang dihadapi, dan tetapkan target perbaikan untuk periode berikutnya.`;
}

/** Returns null when the staff member has no flagged issues this period. */
export function evaluateStaff(staff: StaffAttendanceRecord, workingDaysInPeriod: number): HRStaffFlag | null {
  const attendanceRatePct = computeAttendanceRatePct(staff, workingDaysInPeriod);
  const issues = detectIssues(staff, attendanceRatePct);
  if (issues.length === 0) return null;

  return {
    staffId: staff.staffId,
    name: staff.name,
    branch: staff.branch,
    role: staff.role,
    issues,
    attendanceRatePct,
    kpiScore: staff.kpiScore,
    coachingRecommendation: coachingRecommendationFor(staff, issues),
  };
}

export function buildHRAnalysis(periodLabel: string, workingDaysInPeriod: number, staff: StaffAttendanceRecord[]): HRAnalysisData {
  const flaggedStaff = staff.map((s) => evaluateStaff(s, workingDaysInPeriod)).filter((f): f is HRStaffFlag => f !== null);
  const avgKpiScore = staff.length > 0 ? Number((staff.reduce((sum, s) => sum + s.kpiScore, 0) / staff.length).toFixed(1)) : 0;

  return {
    periodLabel,
    totalStaff: staff.length,
    avgKpiScore,
    flaggedStaff,
  };
}

export function buildWeeklyHRTrend(periodLabel: string, dailyReports: AIReport<HRAnalysisData>[]): WeeklyHRTrend {
  if (dailyReports.length === 0) {
    return { periodLabel, daysAggregated: 0, avgFlaggedCount: 0, chronicIssueStaff: [] };
  }

  const avgFlaggedCount = Number(
    (dailyReports.reduce((sum, r) => sum + (r.data?.flaggedStaff.length ?? 0), 0) / dailyReports.length).toFixed(1),
  );

  const flaggedCounts = new Map<string, number>();
  for (const report of dailyReports) {
    for (const flag of report.data?.flaggedStaff ?? []) {
      flaggedCounts.set(flag.name, (flaggedCounts.get(flag.name) ?? 0) + 1);
    }
  }
  const chronicIssueStaff = Array.from(flaggedCounts.entries())
    .filter(([, count]) => count > dailyReports.length / 2)
    .map(([name]) => name);

  return { periodLabel, daysAggregated: dailyReports.length, avgFlaggedCount, chronicIssueStaff };
}

export function buildMonthlyHRRecap(periodLabel: string, dailyReports: AIReport<HRAnalysisData>[]): MonthlyHRRecap {
  const finalAvgKpiScore = dailyReports.length > 0 ? dailyReports[dailyReports.length - 1]!.data?.avgKpiScore ?? 0 : 0;
  const totalFlagIncidents = dailyReports.reduce((sum, r) => sum + (r.data?.flaggedStaff.length ?? 0), 0);

  const note =
    dailyReports.length === 0
      ? "Belum ada laporan harian bulan ini untuk direkap."
      : `Rata-rata KPI akhir bulan ${finalAvgKpiScore}, tercatat ${totalFlagIncidents} insiden flag (absensi/keterlambatan/cuti/KPI) sepanjang bulan.`;

  return { periodLabel, daysAggregated: dailyReports.length, finalAvgKpiScore, totalFlagIncidents, note };
}
