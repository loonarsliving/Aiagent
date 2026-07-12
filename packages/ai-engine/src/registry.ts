import type { AIModuleId } from "@mkh/shared";
import type { AIEmployee } from "./core/ai-employee";
import { marketingIntelligenceEmployee } from "./modules/marketing-intelligence/module";
import { marketingOperationEmployee } from "./modules/marketing-operation/module";
import { metaAdsOperatorEmployee } from "./modules/meta-ads-operator/module";
import { salesSupervisorEmployee } from "./modules/sales-supervisor/module";
import { financeAnalystEmployee } from "./modules/finance-analyst/module";
import { ceoAssistantEmployee } from "./modules/ceo-assistant/module";

/**
 * Single lookup table for every digital employee in the system — the
 * scheduler and the MCP server resolve employees by id through this
 * registry instead of importing each module individually. Adding a 7th
 * employee means adding one line here (plus their schedule entries in
 * packages/database/src/seed-data.ts).
 */
export const EMPLOYEE_REGISTRY: Record<AIModuleId, AIEmployee<unknown>> = {
  "marketing-intelligence": marketingIntelligenceEmployee as AIEmployee<unknown>,
  "marketing-operation": marketingOperationEmployee as AIEmployee<unknown>,
  "meta-ads-operator": metaAdsOperatorEmployee as AIEmployee<unknown>,
  "sales-supervisor": salesSupervisorEmployee as AIEmployee<unknown>,
  "finance-analyst": financeAnalystEmployee as AIEmployee<unknown>,
  "ceo-assistant": ceoAssistantEmployee as AIEmployee<unknown>,
};

export function getEmployee(id: AIModuleId): AIEmployee<unknown> {
  const employee = EMPLOYEE_REGISTRY[id];
  if (!employee) throw new Error(`Unknown AI employee id: ${id}`);
  return employee;
}
