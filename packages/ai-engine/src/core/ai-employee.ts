import type { AIModuleId, AIReport, AIRunContext, EmployeeSOP } from "@mkh/shared";
import type { WorkLogger } from "./work-logger";

/**
 * Every AI is modeled as an employee: an id, a role/description (its "job
 * title"), a declared SOP (see docs/SOP.md for the human-readable mirror),
 * and one task method per cadence it works on. `runDaily` is mandatory —
 * every employee has a daily job; `runWeekly`/`runMonthly` are optional
 * since not every employee's weekly/monthly cadence adds distinct value
 * (though today all six do define all three — see each module's `module.ts`).
 *
 * A task method must never throw for expected failure modes (missing data,
 * connector errors) — it should return an AIReport with status "error"
 * instead. `runEmployeeTask` (agent-runner.ts) catches unexpected throws as
 * a last resort.
 */
export interface AIEmployee<TData = unknown> {
  id: AIModuleId;
  name: string;
  role: string;
  description: string;
  sop: EmployeeSOP;
  runDaily(context: AIRunContext, log: WorkLogger): Promise<AIReport<TData>>;
  runWeekly?(context: AIRunContext, log: WorkLogger): Promise<AIReport<TData>>;
  runMonthly?(context: AIRunContext, log: WorkLogger): Promise<AIReport<TData>>;
}
