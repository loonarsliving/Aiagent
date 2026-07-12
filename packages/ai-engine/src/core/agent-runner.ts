import { createLogger, generateId, type AIReport, type AIRunContext } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import type { AIModule } from "./ai-module";

const logger = createLogger("ai-engine:runner");

/**
 * Runs a module, persists its report, and guarantees a report always comes
 * back — even if the module throws unexpectedly — so callers (scheduler API
 * routes, dashboard "run now" button, CEO Assistant rollup) never have to
 * handle a rejected promise.
 */
export async function runModule<TData>(
  module: AIModule<TData>,
  context: AIRunContext,
): Promise<AIReport<TData>> {
  const startedAt = Date.now();
  logger.info("module run started", { moduleId: module.id, triggeredBy: context.triggeredBy });

  try {
    const report = await module.run(context);
    await getRepository().saveReport(report);
    logger.info("module run finished", {
      moduleId: module.id,
      status: report.status,
      durationMs: Date.now() - startedAt,
    });
    return report;
  } catch (err) {
    const failure: AIReport<TData> = {
      id: generateId("rpt"),
      moduleId: module.id,
      generatedAt: new Date().toISOString(),
      status: "error",
      summary: `${module.name} run failed unexpectedly.`,
      data: undefined as TData,
      error: err instanceof Error ? err.message : String(err),
    };
    await getRepository().saveReport(failure);
    logger.error("module run threw", { moduleId: module.id, error: failure.error });
    return failure;
  }
}
