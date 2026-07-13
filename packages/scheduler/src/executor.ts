import { createLogger, generateId, type ScheduleEntry, type ScheduleRunRecord } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { getEmployee, runEmployeeTask } from "@mkh/ai-engine";
import { LockNotAcquiredError, withDistributedLock } from "./distributed-lock";

const logger = createLogger("scheduler:executor");

/**
 * The one code path for "this schedule entry's time arrived, run it" —
 * used by the local node-cron runner today, and by any future HTTP-
 * triggered cron (Vercel, MK Connect webhook) later without change.
 * Records a ScheduleRunRecord so there's a queryable history per slot,
 * separate from the granular WorkLogEntry trail the employee itself writes.
 *
 * Wrapped in a distributed lock keyed by moduleId+cadence (Sprint 3B) so
 * two scheduler processes (e.g. a redeploy overlapping the old instance)
 * can't both run the same employee's same slot at once. If the lock is
 * already held live elsewhere, this records a "skipped" run instead of
 * calling the employee — that's a deliberate no-op, not an error.
 */
export async function runScheduledTask(entry: ScheduleEntry): Promise<ScheduleRunRecord> {
  const repo = getRepository();
  const lockKey = `scheduler:${entry.moduleId}:${entry.cadence}`;

  try {
    return await withDistributedLock(lockKey, () => executeScheduledTask(entry));
  } catch (error) {
    if (error instanceof LockNotAcquiredError) {
      logger.warn("scheduled task skipped — lock held by another process", { moduleId: entry.moduleId, cadence: entry.cadence, lockKey });
      const skipped: ScheduleRunRecord = {
        id: generateId("run"),
        moduleId: entry.moduleId,
        cadence: entry.cadence,
        scheduledTime: entry.time,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        status: "skipped",
      };
      return repo.saveScheduleRun(skipped);
    }
    throw error;
  }
}

async function executeScheduledTask(entry: ScheduleEntry): Promise<ScheduleRunRecord> {
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
