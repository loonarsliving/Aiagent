import { createLogger, generateId, type AIModuleId, type ScheduleRunRecord } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { getModule, runModule } from "@mkh/ai-engine";

const logger = createLogger("scheduler:executor");

/**
 * Shared by the local node-cron runner and the Vercel Cron API routes
 * (apps/dashboard/src/app/api/cron/[moduleId]) — one code path for "run
 * this module because its scheduled time arrived," recorded in
 * schedule_runs so the dashboard can show history per slot.
 */
export async function runScheduledModule(moduleId: AIModuleId, scheduledTime: string): Promise<ScheduleRunRecord> {
  const repo = getRepository();
  const run: ScheduleRunRecord = {
    id: generateId("run"),
    moduleId,
    scheduledTime,
    startedAt: new Date().toISOString(),
    status: "running",
  };
  await repo.saveScheduleRun(run);
  logger.info("scheduled run started", { moduleId, scheduledTime });

  const module = getModule(moduleId);
  const report = await runModule(module, { triggeredBy: "scheduler" });

  const updated = await repo.updateScheduleRun(run.id, {
    finishedAt: new Date().toISOString(),
    status: report.status === "success" ? "success" : "error",
    reportId: report.id,
  });

  logger.info("scheduled run finished", { moduleId, status: updated.status });
  return updated;
}
