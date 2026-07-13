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

/** One measurable success metric for an AI Worker, with what "good" looks like — not a live-computed number, a declared target for humans reviewing this worker's output over time. */
export interface EmployeeKPI {
  metric: string;
  target: string;
}

/**
 * Sprint 3A: the business-facing identity layer every AI Worker needs on
 * top of its PromptDefinition (which is Gemini-facing) and GovernanceProfile
 * (which is authority-facing). Mission/Scope/KPI are genuinely new fields —
 * Role already exists on AIEmployee, Decision/Escalation Rules already
 * exist on PromptDefinition, Approval Rules already exist on
 * GovernanceProfile; this type deliberately does not duplicate any of
 * those to avoid two sources of truth drifting apart.
 */
export interface EmployeeProfile {
  moduleId: AIModuleId | "notification-coordinator";
  /** One sentence: why this worker exists. */
  mission: string;
  /** What this worker does and, explicitly, does not do. */
  scope: string;
  kpis: EmployeeKPI[];
}
