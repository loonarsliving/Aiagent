export type HRIssueType = "keterlambatan" | "kehadiran_rendah" | "cuti_melebihi_kuota" | "kpi_rendah";

export interface HRStaffFlag {
  staffId: string;
  name: string;
  branch: string;
  role: string;
  issues: HRIssueType[];
  attendanceRatePct: number;
  kpiScore: number;
  coachingRecommendation: string;
}

export interface HRAnalysisData {
  periodLabel: string;
  totalStaff: number;
  avgKpiScore: number;
  flaggedStaff: HRStaffFlag[];
}

export interface WeeklyHRTrend {
  periodLabel: string;
  daysAggregated: number;
  avgFlaggedCount: number;
  chronicIssueStaff: string[];
}

export interface MonthlyHRRecap {
  periodLabel: string;
  daysAggregated: number;
  finalAvgKpiScore: number;
  totalFlagIncidents: number;
  note: string;
}
