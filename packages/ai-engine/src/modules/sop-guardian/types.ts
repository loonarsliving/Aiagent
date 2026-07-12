import type { AIModuleId } from "@mkh/shared";

export type SOPViolationType = "missed_run" | "run_failed" | "excessive_retry" | "structural_step_missing";

export interface SOPViolation {
  moduleId: AIModuleId;
  violationType: SOPViolationType;
  detail: string;
  warning: string;
}

export interface SOPComplianceData {
  periodLabel: string;
  employeesChecked: number;
  violations: SOPViolation[];
  compliantModuleIds: AIModuleId[];
}

export interface WeeklySOPTrend {
  periodLabel: string;
  daysAggregated: number;
  avgViolationCount: number;
  chronicViolatorModuleIds: AIModuleId[];
}

export interface MonthlySOPRecap {
  periodLabel: string;
  daysAggregated: number;
  totalViolationIncidents: number;
  note: string;
}
