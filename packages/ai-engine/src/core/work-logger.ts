import { createLogger, generateId, type AIModuleId, type TaskCadence, type WorkLogStatus } from "@mkh/shared";
import { getRepository } from "@mkh/database";

/**
 * The granular, persisted "what did the AI actually do" trail — e.g.
 * `log.step("Research Completed")` inside an employee's runDaily produces
 * a WorkLogEntry row (see @mkh/database) in addition to the usual
 * structured console log. Every task method receives one of these,
 * constructed fresh per run by runEmployeeTask (agent-runner.ts). The
 * `attempt` field is stamped automatically by the runner (via `forAttempt`)
 * so an employee's own step() calls don't need to know about retries.
 */
export interface WorkLogger {
  step(step: string, detail?: string, status?: WorkLogStatus): Promise<void>;
}

/** Internal: lets the runner tag every step written during a given retry attempt, without employee code needing to pass the attempt number itself. */
export interface RunnerWorkLogger extends WorkLogger {
  forAttempt(attempt: number): WorkLogger;
}

export function createWorkLogger(moduleId: AIModuleId, runId: string, cadence: TaskCadence): RunnerWorkLogger {
  const logger = createLogger(`employee:${moduleId}`);

  function write(step: string, detail: string | undefined, status: WorkLogStatus, attempt: number): Promise<void> {
    logger.info(step, { detail, cadence, runId, attempt });
    return getRepository()
      .logWorkStep({
        id: generateId("wl"),
        moduleId,
        runId,
        cadence,
        step,
        status,
        detail,
        loggedAt: new Date().toISOString(),
        attempt,
      })
      .then(() => undefined);
  }

  const base: RunnerWorkLogger = {
    async step(step, detail, status = "info") {
      await write(step, detail, status, 0);
    },
    forAttempt(attempt: number): WorkLogger {
      return {
        async step(step, detail, status = "info") {
          await write(step, detail, status, attempt);
        },
      };
    },
  };

  return base;
}
