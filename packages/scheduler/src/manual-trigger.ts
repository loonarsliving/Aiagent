import { createLogger, generateId, type AIModuleId, type ScheduleRunRecord, type TaskCadence } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { getEmployee, runEmployeeTask } from "@mkh/ai-engine";

const logger = createLogger("scheduler:manual-trigger");

export interface ManualTriggerInput {
  moduleId: AIModuleId;
  cadence: TaskCadence;
  /** Who/what asked for this run — free text (e.g. "operator:cli", later "mk-connect"). */
  requestedBy: string;
}

/**
 * The programmatic entry point for running any employee on demand, outside
 * its normal schedule — e.g. "jalankan Finance Analyst sekarang" or MK
 * Connect needing a fresh report right away. No UI: this is a plain
 * function today (see bin/trigger.ts for a CLI wrapper), ready to be
 * imported and called directly from MK Connect's backend once that
 * integration is authorized. Shares the exact same runEmployeeTask/
 * ScheduleRunRecord codepath as a scheduled run — the only difference is
 * `scheduledTime: "manual"` and `triggeredBy: "manual"` so manual runs are
 * distinguishable in history from cron-triggered ones.
 */
export async function triggerEmployee(input: ManualTriggerInput): Promise<ScheduleRunRecord> {
  const { moduleId, cadence, requestedBy } = input;
  const repo = getRepository();
  const employee = getEmployee(moduleId); // throws for an unknown id — fails loudly rather than silently no-op-ing

  const run: ScheduleRunRecord = {
    id: generateId("run"),
    moduleId,
    cadence,
    scheduledTime: "manual",
    startedAt: new Date().toISOString(),
    status: "running",
  };
  await repo.saveScheduleRun(run);
  logger.info("manual trigger started", { moduleId, cadence, requestedBy });

  const report = await runEmployeeTask(employee, cadence, { triggeredBy: "manual", requestedBy });

  const updated = await repo.updateScheduleRun(run.id, {
    finishedAt: new Date().toISOString(),
    status: report.status === "success" ? "success" : "error",
    reportId: report.id,
  });

  logger.info("manual trigger finished", { moduleId, cadence, requestedBy, status: updated.status });
  return updated;
}
