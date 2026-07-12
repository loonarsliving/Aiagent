import type { AIModuleId } from "@mkh/shared";
import type { AIEmployee } from "./core/ai-employee";
import { marketingIntelligenceEmployee } from "./modules/marketing-intelligence/module";
import { contentPlannerEmployee } from "./modules/content-planner/module";
import { metaAdsSpecialistEmployee } from "./modules/meta-ads-specialist/module";
import { salesSupervisorEmployee } from "./modules/sales-supervisor/module";
import { branchPerformanceManagerEmployee } from "./modules/branch-performance-manager/module";
import { financeAnalystEmployee } from "./modules/finance-analyst/module";
import { hrOfficerEmployee } from "./modules/hr-officer/module";
import { otaManagerEmployee } from "./modules/ota-manager/module";
import { sopGuardianEmployee } from "./modules/sop-guardian/module";
import { ceoAssistantEmployee } from "./modules/ceo-assistant/module";

/**
 * Single lookup table for every digital employee in the system — the
 * scheduler, the manual-trigger service, and the MCP server resolve
 * employees by id through this registry instead of importing each module
 * individually. Adding an 11th employee means adding one line here (plus
 * their schedule entries in packages/database/src/seed-data.ts).
 */
export const EMPLOYEE_REGISTRY: Record<AIModuleId, AIEmployee<unknown>> = {
  "marketing-intelligence": marketingIntelligenceEmployee as AIEmployee<unknown>,
  "content-planner": contentPlannerEmployee as AIEmployee<unknown>,
  "meta-ads-specialist": metaAdsSpecialistEmployee as AIEmployee<unknown>,
  "sales-supervisor": salesSupervisorEmployee as AIEmployee<unknown>,
  "branch-performance-manager": branchPerformanceManagerEmployee as AIEmployee<unknown>,
  "finance-analyst": financeAnalystEmployee as AIEmployee<unknown>,
  "hr-officer": hrOfficerEmployee as AIEmployee<unknown>,
  "ota-manager": otaManagerEmployee as AIEmployee<unknown>,
  "sop-guardian": sopGuardianEmployee as AIEmployee<unknown>,
  "ceo-assistant": ceoAssistantEmployee as AIEmployee<unknown>,
};

export function getEmployee(id: AIModuleId): AIEmployee<unknown> {
  const employee = EMPLOYEE_REGISTRY[id];
  if (!employee) throw new Error(`Unknown AI employee id: ${id}`);
  return employee;
}
