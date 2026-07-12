import type { AIModuleId } from "@mkh/shared";

/**
 * Static facts about the company every prompt is grounded in — kept as a
 * plain config-layer constant (see company-context.ts), not fetched from
 * any external API (Sprint 2 explicitly forbids new external APIs besides
 * Gemini).
 */
export interface CompanyContext {
  companyName: string;
  industry: string;
  timezone: string;
  ownerTitle: string;
}

/**
 * Every Digital Employee's own prompt — the ten required sections from the
 * Sprint 2 brief. One PromptDefinition per employee (plus the Notification
 * Coordinator), defined in reasoning/prompts/*.ts and looked up through
 * getPromptDefinition() — never inlined ad hoc in a module.ts.
 */
export interface PromptDefinition {
  moduleId: AIModuleId | "notification-coordinator";
  role: string;
  objective: string;
  sop: string;
  restriction: string;
  decisionRule: string;
  outputRule: string;
  escalationRule: string;
  memoryRule: string;
  knowledgeRule: string;
}
