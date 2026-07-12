import { createLogger, generateId, type AIModuleId, type TaskCadence, type WorkLogStatus } from "@mkh/shared";
import { getRepository } from "@mkh/database";

/**
 * The granular, persisted "what did the AI actually do" trail — e.g.
 * `log.step("Research Completed")` inside an employee's runDaily produces
 * a WorkLogEntry row (see @mkh/database) in addition to the usual
 * structured console log. Every task method receives one of these,
 * constructed fresh per run by runEmployeeTask (agent-runner.ts).
 */
export interface WorkLogger {
  step(step: string, detail?: string, status?: WorkLogStatus): Promise<void>;
}

export function createWorkLogger(moduleId: AIModuleId, runId: string, cadence: TaskCadence): WorkLogger {
  const logger = createLogger(`employee:${moduleId}`);
  return {
    async step(step: string, detail?: string, status: WorkLogStatus = "info") {
      logger.info(step, { detail, cadence, runId });
      await getRepository().logWorkStep({
        id: generateId("wl"),
        moduleId,
        runId,
        cadence,
        step,
        status,
        detail,
        loggedAt: new Date().toISOString(),
      });
    },
  };
}
