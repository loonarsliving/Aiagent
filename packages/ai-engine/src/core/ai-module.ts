import type { AIModuleId, AIReport, AIRunContext } from "@mkh/shared";

/**
 * Every AI "digital employee" implements this. `run()` must never throw for
 * expected failure modes (missing data, connector errors) — it should
 * return an AIReport with status "error" instead, so the scheduler and
 * dashboard always have something to show. AgentRunner (agent-runner.ts)
 * catches unexpected throws as a last resort.
 */
export interface AIModule<TData = unknown> {
  id: AIModuleId;
  name: string;
  description: string;
  run(context: AIRunContext): Promise<AIReport<TData>>;
}
