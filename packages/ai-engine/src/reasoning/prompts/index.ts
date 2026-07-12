import type { PromptDefinition } from "../types";
import { ceoAssistantPrompt } from "./ceo-assistant.prompt";
import { marketingIntelligencePrompt } from "./marketing-intelligence.prompt";
import { contentPlannerPrompt } from "./content-planner.prompt";
import { metaAdsSpecialistPrompt } from "./meta-ads-specialist.prompt";
import { salesSupervisorPrompt } from "./sales-supervisor.prompt";
import { branchPerformanceManagerPrompt } from "./branch-performance-manager.prompt";
import { financeAnalystPrompt } from "./finance-analyst.prompt";
import { hrOfficerPrompt } from "./hr-officer.prompt";
import { otaManagerPrompt } from "./ota-manager.prompt";
import { sopGuardianPrompt } from "./sop-guardian.prompt";
import { notificationCoordinatorPrompt } from "./notification-coordinator.prompt";

/**
 * One PromptDefinition per Digital Employee (+ Notification Coordinator).
 * Keyed by moduleId so getPromptDefinition() never needs an if/else chain
 * — adding an 11th cadence-scheduled employee later is "add one file here."
 */
export const PROMPT_DEFINITIONS: Record<PromptDefinition["moduleId"], PromptDefinition> = {
  "ceo-assistant": ceoAssistantPrompt,
  "marketing-intelligence": marketingIntelligencePrompt,
  "content-planner": contentPlannerPrompt,
  "meta-ads-specialist": metaAdsSpecialistPrompt,
  "sales-supervisor": salesSupervisorPrompt,
  "branch-performance-manager": branchPerformanceManagerPrompt,
  "finance-analyst": financeAnalystPrompt,
  "hr-officer": hrOfficerPrompt,
  "ota-manager": otaManagerPrompt,
  "sop-guardian": sopGuardianPrompt,
  "notification-coordinator": notificationCoordinatorPrompt,
};

export {
  ceoAssistantPrompt,
  marketingIntelligencePrompt,
  contentPlannerPrompt,
  metaAdsSpecialistPrompt,
  salesSupervisorPrompt,
  branchPerformanceManagerPrompt,
  financeAnalystPrompt,
  hrOfficerPrompt,
  otaManagerPrompt,
  sopGuardianPrompt,
  notificationCoordinatorPrompt,
};
