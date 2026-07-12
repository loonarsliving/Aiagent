import { describe, expect, it } from "vitest";
import type { KnowledgeItem } from "@mkh/database";
import { AI_MODULE_IDS } from "@mkh/shared";
import { buildSystemPrompt, buildUserPrompt, getPromptDefinition } from "./prompt-engine";
import { COMPANY_CONTEXT } from "./company-context";

describe("getPromptDefinition", () => {
  it("resolves a PromptDefinition for every AI_MODULE_ID plus notification-coordinator", () => {
    for (const moduleId of [...AI_MODULE_IDS, "notification-coordinator" as const]) {
      const def = getPromptDefinition(moduleId);
      expect(def.moduleId).toBe(moduleId);
    }
  });

  it("throws for an unregistered moduleId instead of returning undefined", () => {
    // @ts-expect-error deliberately invalid id
    expect(() => getPromptDefinition("not-a-real-employee")).toThrow();
  });
});

describe("buildSystemPrompt", () => {
  it("includes all ten required sections plus the JSON output contract", () => {
    const prompt = buildSystemPrompt(getPromptDefinition("finance-analyst"));
    for (const heading of [
      "# ROLE",
      "# OBJECTIVE",
      "# SOP",
      "# RESTRICTION",
      "# DECISION RULE",
      "# OUTPUT RULE",
      "# ESCALATION RULE",
      "# MEMORY RULE",
      "# KNOWLEDGE RULE",
      "# COMPANY CONTEXT",
      "# OUTPUT FORMAT",
    ]) {
      expect(prompt).toContain(heading);
    }
    expect(prompt).toContain("confidenceScore");
    expect(prompt).toContain("needApproval");
  });

  it("embeds the company context passed in", () => {
    const prompt = buildSystemPrompt(getPromptDefinition("finance-analyst"), COMPANY_CONTEXT);
    expect(prompt).toContain(COMPANY_CONTEXT.companyName);
    expect(prompt).toContain(COMPANY_CONTEXT.timezone);
  });
});

describe("buildUserPrompt — token optimization", () => {
  it("includes only the observation section when nothing else is provided", () => {
    const prompt = buildUserPrompt({ observation: "Test observation" });
    expect(prompt).toContain("OBSERVASI HARI INI");
    expect(prompt).toContain("Test observation");
    expect(prompt).not.toContain("DATA TERKAIT");
    expect(prompt).not.toContain("KNOWLEDGE RELEVAN");
    expect(prompt).not.toContain("MEMORY");
  });

  it("omits empty contextData/knowledge/memory sections rather than sending them empty", () => {
    const prompt = buildUserPrompt({ observation: "x", contextData: {}, knowledge: [], memory: [] });
    expect(prompt).not.toContain("DATA TERKAIT");
    expect(prompt).not.toContain("KNOWLEDGE RELEVAN");
    expect(prompt).not.toContain("MEMORY");
  });

  function knowledgeItem(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
    return {
      id: "k1",
      moduleId: "finance-analyst",
      category: "anomaly-history",
      title: "Test item",
      firstSeenAt: "2026-07-12T00:00:00.000Z",
      lastSeenAt: "2026-07-12T00:00:00.000Z",
      timesSeen: 1,
      metadata: {},
      ...overrides,
    };
  }

  it("includes contextData, knowledge, and memory sections when present", () => {
    const prompt = buildUserPrompt({
      observation: "obs",
      contextData: { netCashflowIdr: 1000 },
      knowledge: [knowledgeItem({ title: "Anomaly A" })],
      memory: [knowledgeItem({ title: "Past decision X" })],
    });
    expect(prompt).toContain("DATA TERKAIT");
    expect(prompt).toContain("netCashflowIdr");
    expect(prompt).toContain("KNOWLEDGE RELEVAN");
    expect(prompt).toContain("Anomaly A");
    expect(prompt).toContain("MEMORY");
    expect(prompt).toContain("Past decision X");
  });
});
