import { AI_MODULE_IDS, createLogger, generateId, type AIModuleId, type ScheduleRunRecord, type TaskCadence } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { getEmployee, runEmployeeTask } from "@mkh/ai-engine";

const logger = createLogger("scheduler:manual-trigger");

export interface ManualTriggerInput {
  moduleId: AIModuleId;
  cadence: TaskCadence;
  /** Who/what asked for this run — free text (e.g. "operator:cli", later "mk-connect"). */
  requestedBy: string;
  /**
   * Sprint 3B — validate the request (employee id exists, the requested
   * cadence has a task method) and report what *would* run, without
   * calling runEmployeeTask or writing a ScheduleRunRecord. Useful for a
   * CLI `--dry-run` flag or for MK Connect to sanity-check a trigger
   * request before committing to it.
   */
  dryRun?: boolean;
}

export interface DryRunResult {
  dryRun: true;
  moduleId: AIModuleId;
  cadence: TaskCadence;
  employeeName: string;
  requestedBy: string;
  checkedAt: string;
}

/** Cadence -> the AIEmployee method name that serves it, mirroring runScheduledTask/agent-runner's own dispatch. */
export function cadenceMethodExists(employee: ReturnType<typeof getEmployee>, cadence: TaskCadence): boolean {
  if (cadence === "daily") return typeof employee.runDaily === "function";
  if (cadence === "weekly") return typeof employee.runWeekly === "function";
  return typeof employee.runMonthly === "function";
}

/**
 * The programmatic entry point for running any employee on demand, outside
 * its normal schedule — e.g. "jalankan Finance Analyst sekarang" or MK
 * Connect needing a fresh report right away. No UI: this is a plain
 * function today (see trigger-cli.ts for a CLI wrapper), ready to be
 * imported and called directly from MK Connect's backend once that
 * integration is authorized. Shares the exact same runEmployeeTask/
 * ScheduleRunRecord codepath as a scheduled run — the only difference is
 * `scheduledTime: "manual"` and `triggeredBy: "manual"` so manual runs are
 * distinguishable in history from cron-triggered ones.
 */
export async function triggerEmployee(input: ManualTriggerInput): Promise<ScheduleRunRecord | DryRunResult> {
  const { moduleId, cadence, requestedBy, dryRun } = input;
  const employee = getEmployee(moduleId); // throws for an unknown id — fails loudly rather than silently no-op-ing

  if (dryRun) {
    if (!cadenceMethodExists(employee, cadence)) {
      throw new Error(`${moduleId} does not implement a "${cadence}" task`);
    }
    logger.info("dry run — validated, would execute", { moduleId, cadence, requestedBy });
    return { dryRun: true, moduleId, cadence, employeeName: employee.name, requestedBy, checkedAt: new Date().toISOString() };
  }

  const repo = getRepository();
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

export interface TriggerAllWorkersInput {
  cadence: TaskCadence;
  requestedBy: string;
  dryRun?: boolean;
}

/**
 * "Trigger by Company" (Sprint 3B brief) — the system models exactly one
 * company today, so triggering every worker company-wide means triggering
 * every registered employee. Runs sequentially (not Promise.all) so one
 * employee's failure doesn't abort the others and so ScheduleRunRecord
 * writes for concurrent runs of *different* employees never race each
 * other in a way that's hard to reason about.
 *
 * Note on scope: the brief also mentions "Trigger by Branch" and "Trigger
 * by Employee". This system has no per-branch worker instantiation (e.g.
 * Branch Performance Manager already analyzes every branch in one run), so
 * a distinct branch-level trigger would require an architecture change out
 * of proportion to this sprint — out of scope here. "Trigger by Employee"
 * is exactly `triggerEmployee` above (an "employee" in this system's model
 * *is* a digital worker, there's no separate human-staff-triggering
 * concept).
 */
export async function triggerAllWorkers(input: TriggerAllWorkersInput): Promise<(ScheduleRunRecord | DryRunResult)[]> {
  const results: (ScheduleRunRecord | DryRunResult)[] = [];
  for (const moduleId of AI_MODULE_IDS) {
    results.push(await triggerEmployee({ moduleId, cadence: input.cadence, requestedBy: input.requestedBy, dryRun: input.dryRun }));
  }
  return results;
}
