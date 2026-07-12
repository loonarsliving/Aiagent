import { createLogger, generateId, type ScheduleEntry, type ScheduleRunRecord } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { getEmployee, runEmployeeTask } from "@mkh/ai-engine";

const logger = createLogger("scheduler:executor");

/**
 * The one code path for "this schedule entry's time arrived, run it" —
 * used by the local node-cron runner today, and by any future HTTP-
 * triggered cron (Vercel, MK Connect webhook) later without change.
 * Records a ScheduleRunRecord so there's a queryable history per slot,
 * separate from the granular WorkLogEntry trail the employee itself writes.
 */
export async function runScheduledTask(entry: ScheduleEntry): Promise<ScheduleRunRecord> {
  const repo = getRepository();
  const run: ScheduleRunRecord = {
    id: generateId("run"),
    moduleId: entry.moduleId,
    cadence: entry.cadence,
    scheduledTime: entry.time,
    startedAt: new Date().toISOString(),
    status: "running",
  };
  await repo.saveScheduleRun(run);
  logger.info("scheduled task started", { moduleId: entry.moduleId, cadence: entry.cadence, scheduledTime: entry.time });

  const employee = getEmployee(entry.moduleId);
  const report = await runEmployeeTask(employee, entry.cadence, { triggeredBy: "scheduler" });

  const updated = await repo.updateScheduleRun(run.id, {
    finishedAt: new Date().toISOString(),
    status: report.status === "success" ? "success" : "error",
    reportId: report.id,
  });

  logger.info("scheduled task finished", { moduleId: entry.moduleId, cadence: entry.cadence, status: updated.status });
  return updated;
}
