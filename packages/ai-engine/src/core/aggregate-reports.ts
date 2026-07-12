import type { AIModuleId, AIReport } from "@mkh/shared";
import { getRepository } from "@mkh/database";

/**
 * Shared building block for weekly/monthly task methods: pulls the last N
 * daily reports for an employee, oldest first, so weekly/monthly logic can
 * summarize a real window instead of re-deriving from scratch. Keeps
 * weekly/monthly implementations genuine (they look at real history) while
 * avoiding 12 bespoke aggregation routines across the six employees.
 */
export async function aggregateRecentReports<TData>(moduleId: AIModuleId, days: number): Promise<AIReport<TData>[]> {
  const reports = await getRepository().listRecentReports(moduleId, "daily", days);
  return reports as AIReport<TData>[];
}
