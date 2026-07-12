import { createLogger, generateId, type AIReport, type AIRunContext, type TaskCadence } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import type { AIEmployee } from "./ai-employee";
import { createWorkLogger } from "./work-logger";

const logger = createLogger("ai-engine:runner");

/**
 * Runs one employee's task for a given cadence, records the granular work
 * log (started/finished at minimum — task methods add their own steps in
 * between), persists the resulting report, and guarantees a report always
 * comes back even if the task method throws unexpectedly — so callers
 * (the scheduler, a manual script, ceo-assistant reading siblings) never
 * have to handle a rejected promise.
 */
export async function runEmployeeTask<TData>(
  employee: AIEmployee<TData>,
  cadence: TaskCadence,
  context: AIRunContext,
): Promise<AIReport<TData>> {
  const runId = generateId("run");
  const workLog = createWorkLogger(employee.id, runId, cadence);
  const startedAt = Date.now();

  logger.info("employee task started", { moduleId: employee.id, cadence, triggeredBy: context.triggeredBy });
  await workLog.step("started", `Mulai bekerja (${cadence})`);

  try {
    const handler =
      cadence === "daily" ? employee.runDaily : cadence === "weekly" ? employee.runWeekly : employee.runMonthly;
    if (!handler) {
      throw new Error(`${employee.id} has no "${cadence}" task defined`);
    }

    const report = await handler.call(employee, context, workLog);
    await getRepository().saveReport(report);
    await workLog.step("finished", report.summary, "success");
    logger.info("employee task finished", {
      moduleId: employee.id,
      cadence,
      status: report.status,
      durationMs: Date.now() - startedAt,
    });
    return report;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failure: AIReport<TData> = {
      id: generateId("rpt"),
      moduleId: employee.id,
      cadence,
      generatedAt: new Date().toISOString(),
      status: "error",
      summary: `${employee.name} ${cadence} task failed unexpectedly.`,
      data: undefined as TData,
      error: message,
    };
    await getRepository().saveReport(failure);
    await workLog.step("finished", message, "error");
    logger.error("employee task threw", { moduleId: employee.id, cadence, error: message });
    return failure;
  }
}
