import type { AIModuleId } from "@mkh/shared";
import type { AIModule } from "./core/ai-module";
import { marketingStrategistModule } from "./modules/marketing-strategist/module";
import { metaAdsOperatorModule } from "./modules/meta-ads-operator/module";
import { salesSupervisorModule } from "./modules/sales-supervisor/module";
import { financeAnalystModule } from "./modules/finance-analyst/module";
import { ceoAssistantModule } from "./modules/ceo-assistant/module";

/**
 * Single lookup table for every module in the system — the scheduler,
 * dashboard "run now" buttons, and the MCP server all resolve modules by
 * id through this registry instead of importing each module individually.
 * Adding a 6th AI module means adding one line here.
 */
export const MODULE_REGISTRY: Record<AIModuleId, AIModule<unknown>> = {
  "marketing-strategist": marketingStrategistModule as AIModule<unknown>,
  "meta-ads-operator": metaAdsOperatorModule as AIModule<unknown>,
  "sales-supervisor": salesSupervisorModule as AIModule<unknown>,
  "finance-analyst": financeAnalystModule as AIModule<unknown>,
  "ceo-assistant": ceoAssistantModule as AIModule<unknown>,
};

export function getModule(id: AIModuleId): AIModule<unknown> {
  const module = MODULE_REGISTRY[id];
  if (!module) throw new Error(`Unknown AI module id: ${id}`);
  return module;
}
