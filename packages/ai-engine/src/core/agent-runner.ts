import { createLogger, generateId, getConfig, type AIReport, type AIRunContext, type TaskCadence } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import type { AIEmployee } from "./ai-employee";
import { createWorkLogger } from "./work-logger";

const logger = createLogger("ai-engine:runner");

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function buildFailureReport<TData>(
  employee: AIEmployee<TData>,
  cadence: TaskCadence,
  message: string,
  durationMs: number,
  retryCount: number,
): AIReport<TData> {
  return {
    id: generateId("rpt"),
    moduleId: employee.id,
    cadence,
    generatedAt: new Date().toISOString(),
    status: "error",
    summary: `${employee.name} ${cadence} task failed unexpectedly.`,
    data: undefined as TData,
    error: message,
    durationMs,
    retryCount,
  };
}

/**
 * Runs one employee's task for a given cadence with an automatic retry
 * strategy: up to `MAX_RETRY_ATTEMPTS` tries (config layer, default 3),
 * exponential backoff between attempts (`RETRY_BACKOFF_MS * 2^attempt`).
 * No employee ever "just fails" on a transient error — only after every
 * retry is exhausted does this return a `status: "error"` report, and
 * even then it returns rather than throws, so callers (the scheduler, the
 * manual-trigger service, ceo-assistant reading siblings) never have to
 * handle a rejected promise. Every attempt is recorded in the work log,
 * and the final report always carries `durationMs`/`retryCount`.
 */
export async function runEmployeeTask<TData>(
  employee: AIEmployee<TData>,
  cadence: TaskCadence,
  context: AIRunContext,
): Promise<AIReport<TData>> {
  const runId = generateId("run");
  const workLog = createWorkLogger(employee.id, runId, cadence);
  const startedAt = Date.now();
  const { MAX_RETRY_ATTEMPTS, RETRY_BACKOFF_MS } = getConfig();

  logger.info("employee task started", { moduleId: employee.id, cadence, triggeredBy: context.triggeredBy });
  await workLog.forAttempt(0).step("started", `Mulai bekerja (${cadence})`);

  const handler =
    cadence === "daily" ? employee.runDaily : cadence === "weekly" ? employee.runWeekly : employee.runMonthly;

  if (!handler) {
    const message = `${employee.id} has no "${cadence}" task defined`;
    const failure = buildFailureReport(employee, cadence, message, Date.now() - startedAt, 0);
    await getRepository().saveReport(failure);
    await workLog.forAttempt(0).step("finished", message, "error");
    logger.error("employee task has no handler for this cadence", { moduleId: employee.id, cadence });
    return failure;
  }

  let lastError = "unknown error";
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    const attemptLog = workLog.forAttempt(attempt);
    try {
      const report = await handler.call(employee, context, attemptLog);
      const finished: AIReport<TData> = { ...report, durationMs: Date.now() - startedAt, retryCount: attempt };
      await getRepository().saveReport(finished);
      await attemptLog.step("finished", finished.summary, "success");
      logger.info("employee task finished", {
        moduleId: employee.id,
        cadence,
        status: finished.status,
        durationMs: finished.durationMs,
        retryCount: attempt,
      });
      return finished;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      const isLastAttempt = attempt === MAX_RETRY_ATTEMPTS - 1;

      if (isLastAttempt) {
        await attemptLog.step("finished", lastError, "error");
        break;
      }

      await attemptLog.step("retry", `Percobaan ${attempt + 1} gagal: ${lastError}. Mencoba lagi...`, "retry");
      logger.warn("employee task attempt failed, retrying", { moduleId: employee.id, cadence, attempt, error: lastError });
      await sleep(RETRY_BACKOFF_MS * 2 ** attempt);
    }
  }

  const failure = buildFailureReport(employee, cadence, lastError, Date.now() - startedAt, MAX_RETRY_ATTEMPTS - 1);
  await getRepository().saveReport(failure);
  logger.error("employee task failed after exhausting retries", {
    moduleId: employee.id,
    cadence,
    attempts: MAX_RETRY_ATTEMPTS,
    error: lastError,
  });
  return failure;
}
