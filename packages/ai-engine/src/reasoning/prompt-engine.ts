import type { KnowledgeItem } from "@mkh/database";
import { getCompanyContext } from "./company-context";
import { PROMPT_DEFINITIONS } from "./prompts/index";
import type { CompanyContext, PromptDefinition } from "./types";

/** Looks up an employee's own PromptDefinition — never hand-built inline in a module.ts. */
export function getPromptDefinition(moduleId: PromptDefinition["moduleId"]): PromptDefinition {
  const definition = PROMPT_DEFINITIONS[moduleId];
  if (!definition) throw new Error(`No PromptDefinition registered for "${moduleId}"`);
  return definition;
}

/**
 * The ten required sections (Role/Objective/SOP/Restriction/Decision Rule/
 * Output Rule/Escalation Rule/Memory Rule/Knowledge Rule/Company Context)
 * plus the Output Engine's JSON contract — this is what makes every
 * provider call return a parseable ReasoningOutput regardless of provider.
 */
export function buildSystemPrompt(promptDefinition: PromptDefinition, companyContext: CompanyContext = getCompanyContext()): string {
  return [
    `# ROLE\n${promptDefinition.role}`,
    `# OBJECTIVE\n${promptDefinition.objective}`,
    `# SOP\n${promptDefinition.sop}`,
    `# RESTRICTION\n${promptDefinition.restriction}`,
    `# DECISION RULE\n${promptDefinition.decisionRule}`,
    `# OUTPUT RULE\n${promptDefinition.outputRule}`,
    `# ESCALATION RULE\n${promptDefinition.escalationRule}`,
    `# MEMORY RULE\n${promptDefinition.memoryRule}`,
    `# KNOWLEDGE RULE\n${promptDefinition.knowledgeRule}`,
    `# COMPANY CONTEXT\nPerusahaan: ${companyContext.companyName}\nIndustri: ${companyContext.industry}\nZona waktu operasional: ${companyContext.timezone}\nAnda melapor kepada: ${companyContext.ownerTitle}`,
    `# OUTPUT FORMAT\nJawab HANYA dengan satu objek JSON valid (tanpa markdown code fence, tanpa teks lain di luar JSON) dengan struktur PERSIS berikut:\n{\n  "priority": "low" | "medium" | "high" | "urgent",\n  "summary": string,\n  "recommendation": string,\n  "reason": string,\n  "confidenceScore": number antara 0 dan 1,\n  "needApproval": boolean,\n  "escalation": string atau null,\n  "nextAction": string\n}`,
  ].join("\n\n");
}

export interface UserPromptInput {
  /** What happened — usually the deterministic AIReport.summary already computed by the employee's own logic.ts. */
  observation: string;
  /** Structured deterministic data relevant to this decision — kept small; this IS the "Collect Context" step's output. */
  contextData?: Record<string, unknown>;
  /** Retrieval Layer's top-K relevant knowledge items — never the whole knowledge base. */
  knowledge?: KnowledgeItem[];
  /** Retrieval Layer's own-reasoning-history items — this employee's memory of its own past recommendations. */
  memory?: KnowledgeItem[];
}

/**
 * Token optimization in practice: every section is omitted entirely when
 * empty, rather than sending "## DATA TERKAIT\n{}" or "## MEMORY\n(none)"
 * — an empty section still costs prompt tokens for no informational value.
 */
export function buildUserPrompt(input: UserPromptInput): string {
  const parts = [`## OBSERVASI HARI INI\n${input.observation}`];

  if (input.contextData && Object.keys(input.contextData).length > 0) {
    parts.push(`## DATA TERKAIT\n${JSON.stringify(input.contextData)}`);
  }
  if (input.knowledge && input.knowledge.length > 0) {
    parts.push(
      `## KNOWLEDGE RELEVAN\n${input.knowledge.map((k) => `- [${k.category}] ${k.title} (dilihat ${k.timesSeen}x, terakhir ${k.lastSeenAt})`).join("\n")}`,
    );
  }
  if (input.memory && input.memory.length > 0) {
    parts.push(`## MEMORY (riwayat reasoning Anda sendiri)\n${input.memory.map((m) => `- ${m.title} (${m.lastSeenAt})`).join("\n")}`);
  }

  return parts.join("\n\n");
}
