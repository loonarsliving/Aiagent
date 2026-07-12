import { isSameCompanyDay, type AIModuleId, type AIReport, type WorkLogEntry } from "@mkh/shared";
import type { MonthlySOPRecap, SOPComplianceData, SOPViolation, WeeklySOPTrend } from "./types";

/** A daily run's work-log trail must reach "finished" and have at least this many distinct steps to count as structurally sound. */
export const MIN_EXPECTED_STEPS = 2;

export function checkMissedRun(latestReport: AIReport | null, now: Date): boolean {
  if (!latestReport) return true;
  return !isSameCompanyDay(latestReport.generatedAt, now);
}

export function checkRunFailed(latestReport: AIReport | null): boolean {
  return latestReport?.status === "error";
}

export function checkExcessiveRetry(latestReport: AIReport | null): boolean {
  return (latestReport?.retryCount ?? 0) > 0;
}

/** `entries` must already be scoped to a single run (see extractLatestRunSteps). */
export function checkStructuralStepMissing(latestRunSteps: WorkLogEntry[]): boolean {
  if (latestRunSteps.length === 0) return false;
  const hasFinished = latestRunSteps.some((s) => s.step === "finished");
  const distinctSteps = new Set(latestRunSteps.map((s) => s.step)).size;
  return !hasFinished || distinctSteps < MIN_EXPECTED_STEPS;
}

/** `entries` is assumed most-recent-first (Repository.listWorkLog's contract) — picks out just the latest run's steps. */
export function extractLatestRunSteps(entries: WorkLogEntry[]): WorkLogEntry[] {
  if (entries.length === 0) return [];
  const latestRunId = entries[0]!.runId;
  return entries.filter((e) => e.runId === latestRunId);
}

export interface ModuleCheckInput {
  moduleId: AIModuleId;
  latestReport: AIReport | null;
  latestRunSteps: WorkLogEntry[];
}

/** A missed run makes downstream checks (failure/retry/structure) moot — there's nothing fresh to evaluate. */
export function evaluateModule({ moduleId, latestReport, latestRunSteps }: ModuleCheckInput, now: Date): SOPViolation[] {
  if (checkMissedRun(latestReport, now)) {
    return [
      {
        moduleId,
        violationType: "missed_run",
        detail: latestReport ? `Laporan terakhir: ${latestReport.generatedAt} (bukan hari ini).` : "Belum pernah ada laporan.",
        warning: `${moduleId}: tidak ada laporan harian untuk hari ini — kemungkinan run terlewat (missed run).`,
      },
    ];
  }

  const violations: SOPViolation[] = [];

  if (checkRunFailed(latestReport)) {
    violations.push({
      moduleId,
      violationType: "run_failed",
      detail: latestReport?.error ?? "unknown error",
      warning: `${moduleId}: run harian terakhir gagal (status error) setelah seluruh retry habis.`,
    });
  }

  if (checkExcessiveRetry(latestReport)) {
    violations.push({
      moduleId,
      violationType: "excessive_retry",
      detail: `retryCount=${latestReport?.retryCount}`,
      warning: `${moduleId}: run harian terakhir baru berhasil setelah ${latestReport?.retryCount} kali retry.`,
    });
  }

  if (checkStructuralStepMissing(latestRunSteps)) {
    violations.push({
      moduleId,
      violationType: "structural_step_missing",
      detail: `${latestRunSteps.length} step tercatat di work log.`,
      warning: `${moduleId}: jejak SOP di work log tidak lengkap (tidak ada step 'finished' atau step terlalu sedikit).`,
    });
  }

  return violations;
}

export function buildSOPComplianceData(periodLabel: string, checks: ModuleCheckInput[], now: Date = new Date()): SOPComplianceData {
  const allViolations = checks.flatMap((c) => evaluateModule(c, now));
  const violatingModuleIds = new Set(allViolations.map((v) => v.moduleId));

  return {
    periodLabel,
    employeesChecked: checks.length,
    violations: allViolations,
    compliantModuleIds: checks.map((c) => c.moduleId).filter((id) => !violatingModuleIds.has(id)),
  };
}

export function buildWeeklySOPTrend(periodLabel: string, dailyReports: AIReport<SOPComplianceData>[]): WeeklySOPTrend {
  if (dailyReports.length === 0) {
    return { periodLabel, daysAggregated: 0, avgViolationCount: 0, chronicViolatorModuleIds: [] };
  }

  const avgViolationCount = Number(
    (dailyReports.reduce((sum, r) => sum + (r.data?.violations.length ?? 0), 0) / dailyReports.length).toFixed(1),
  );

  const violationCounts = new Map<AIModuleId, number>();
  for (const report of dailyReports) {
    const moduleIdsToday = new Set((report.data?.violations ?? []).map((v) => v.moduleId));
    for (const moduleId of moduleIdsToday) {
      violationCounts.set(moduleId, (violationCounts.get(moduleId) ?? 0) + 1);
    }
  }
  const chronicViolatorModuleIds = Array.from(violationCounts.entries())
    .filter(([, count]) => count > dailyReports.length / 2)
    .map(([moduleId]) => moduleId);

  return { periodLabel, daysAggregated: dailyReports.length, avgViolationCount, chronicViolatorModuleIds };
}

export function buildMonthlySOPRecap(periodLabel: string, dailyReports: AIReport<SOPComplianceData>[]): MonthlySOPRecap {
  const totalViolationIncidents = dailyReports.reduce((sum, r) => sum + (r.data?.violations.length ?? 0), 0);

  const note =
    dailyReports.length === 0
      ? "Belum ada laporan harian bulan ini untuk direkap."
      : `Tercatat ${totalViolationIncidents} insiden pelanggaran SOP sepanjang bulan dari ${dailyReports.length} laporan harian.`;

  return { periodLabel, daysAggregated: dailyReports.length, totalViolationIncidents, note };
}
