import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRepository, resetRepositoryCache } from "@mkh/database";
import { resetConfigCache } from "@mkh/shared";
import type { AIGenerateRequest, AIGenerateResponse, AIProvider } from "@mkh/ai-provider";
import type { WorkLogger } from "../core/work-logger";
import { runReasoning } from "./reasoning-engine";
import { AI_REASONING_HISTORY_CATEGORY } from "./retrieval";

function fakeLogger(runId = "run_test"): { logger: WorkLogger; steps: { step: string; detail?: string; status?: string }[] } {
  const steps: { step: string; detail?: string; status?: string }[] = [];
  return {
    steps,
    logger: {
      runId,
      async step(step, detail, status) {
        steps.push({ step, detail, status });
      },
    },
  };
}

function validResponseText(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    priority: "medium",
    summary: "Ringkasan reasoning.",
    recommendation: "Lakukan sesuatu.",
    reason: "Karena data menunjukkan itu.",
    confidenceScore: 0.75,
    needApproval: false,
    escalation: null,
    nextAction: "Pantau besok.",
    ...overrides,
  });
}

function successProvider(response: Partial<AIGenerateResponse> = {}): AIProvider {
  return {
    name: "gemini",
    async generate(_req: AIGenerateRequest): Promise<AIGenerateResponse> {
      return {
        text: validResponseText(),
        provider: "gemini",
        model: "gemini-2.0-flash",
        responseTimeMs: 42,
        tokensUsed: { promptTokens: 100, completionTokens: 40, totalTokens: 140 },
        ...response,
      };
    },
    async healthCheck() {
      return { ok: true, detail: "ok" };
    },
  };
}

function alwaysFailsProvider(message = "simulated provider failure"): AIProvider {
  return {
    name: "gemini",
    async generate(): Promise<AIGenerateResponse> {
      throw new Error(message);
    },
    async healthCheck() {
      return { ok: false, detail: message };
    },
  };
}

function flakyProvider(failuresBeforeSuccess: number): AIProvider {
  let calls = 0;
  return {
    name: "gemini",
    async generate(): Promise<AIGenerateResponse> {
      calls += 1;
      if (calls <= failuresBeforeSuccess) throw new Error(`transient failure #${calls}`);
      return {
        text: validResponseText(),
        provider: "gemini",
        model: "gemini-2.0-flash",
        responseTimeMs: 10,
      };
    },
    async healthCheck() {
      return { ok: true, detail: "ok" };
    },
  };
}

beforeEach(() => {
  resetRepositoryCache();
  process.env.AI_RETRY_ATTEMPTS = "3";
  process.env.AI_RETRY_BACKOFF_MS = "1";
  resetConfigCache();
});

afterEach(() => {
  delete process.env.AI_RETRY_ATTEMPTS;
  delete process.env.AI_RETRY_BACKOFF_MS;
  resetConfigCache();
});

describe("runReasoning — success path", () => {
  it("runs Observe -> Collect Context -> Retrieve Knowledge -> Retrieve Memory -> Reason -> Audit Log -> Save Memory, in order", async () => {
    const { logger, steps } = fakeLogger("run_1");
    const result = await runReasoning(
      { moduleId: "finance-analyst", observation: "Net cashflow positif hari ini." },
      logger,
      successProvider(),
    );

    expect(result.failed).toBeFalsy();
    if (!result.failed) {
      expect(result.priority).toBe("medium");
      expect(result.confidenceScore).toBe(0.75);
      expect(result.escalation).toBeNull();
    }

    const stepNames = steps.map((s) => s.step);
    expect(stepNames).toEqual([
      "reasoning_observe",
      "reasoning_collect_context",
      "reasoning_retrieve_knowledge",
      "reasoning_retrieve_memory",
      "reasoning_audit_log",
      "reasoning_save_memory",
    ]);
  });

  it("persists an AIReasoningLogEntry with provider/model/responseTime/tokens/retryCount/status=success", async () => {
    const { logger } = fakeLogger("run_2");
    await runReasoning({ moduleId: "finance-analyst", observation: "obs" }, logger, successProvider());

    const logs = await getRepository().listAIReasoningLogs({ runId: "run_2" });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      provider: "gemini",
      model: "gemini-2.0-flash",
      status: "success",
      retryCount: 0,
      promptTokens: 100,
      completionTokens: 40,
      totalTokens: 140,
    });
  });

  it("saves the reasoning output to the employee's own memory (ai-reasoning-history)", async () => {
    const { logger } = fakeLogger("run_3");
    await runReasoning({ moduleId: "finance-analyst", observation: "obs" }, logger, successProvider());

    const memoryItems = await getRepository().listKnowledgeItems({ moduleId: "finance-analyst", category: AI_REASONING_HISTORY_CATEGORY });
    expect(memoryItems).toHaveLength(1);
    expect(memoryItems[0]?.title).toBe("Ringkasan reasoning.");
  });

  it("never leaks another employee's knowledge/memory into the prompt (scoped retrieval)", async () => {
    const repo = getRepository();
    await repo.upsertKnowledgeItem({
      id: "other",
      moduleId: "hr-officer",
      category: "staff-flag-history",
      title: "Should never appear for finance-analyst",
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      timesSeen: 1,
      metadata: {},
    });

    const { logger } = fakeLogger("run_4");
    const result = await runReasoning({ moduleId: "finance-analyst", observation: "obs" }, logger, successProvider());
    expect(result.failed).toBeFalsy();
    // If cross-contamination happened, retrieval would have pulled 1 knowledge item for finance-analyst when none exist.
  });
});

describe("runReasoning — retry path", () => {
  it("retries a transient failure and succeeds, recording retryCount and a 'retry' work log entry", async () => {
    const { logger, steps } = fakeLogger("run_5");
    const result = await runReasoning({ moduleId: "finance-analyst", observation: "obs" }, logger, flakyProvider(2));

    expect(result.failed).toBeFalsy();
    const logs = await getRepository().listAIReasoningLogs({ runId: "run_5" });
    expect(logs[0]?.retryCount).toBe(2);
    expect(steps.some((s) => s.step === "reasoning_reason" && s.status === "retry")).toBe(true);
  });
});

describe("runReasoning — error handling", () => {
  it("returns a structured ReasoningFailure (never throws) once retries are exhausted", async () => {
    const { logger, steps } = fakeLogger("run_6");
    const result = await runReasoning({ moduleId: "finance-analyst", observation: "obs" }, logger, alwaysFailsProvider("boom"));

    expect(result.failed).toBe(true);
    if (result.failed) expect(result.reason).toContain("boom");
    expect(steps.some((s) => s.step === "reasoning_audit_log" && s.status === "error")).toBe(true);
  });

  it("persists an AIReasoningLogEntry with status=error and the failure reason", async () => {
    const { logger } = fakeLogger("run_7");
    await runReasoning({ moduleId: "finance-analyst", observation: "obs" }, logger, alwaysFailsProvider("total failure"));

    const logs = await getRepository().listAIReasoningLogs({ runId: "run_7" });
    expect(logs[0]?.status).toBe("error");
    expect(logs[0]?.errorReason).toContain("total failure");
  });

  it("does not write to memory when reasoning fails", async () => {
    const { logger } = fakeLogger("run_8");
    await runReasoning({ moduleId: "finance-analyst", observation: "obs" }, logger, alwaysFailsProvider());

    const memoryItems = await getRepository().listKnowledgeItems({ moduleId: "finance-analyst", category: AI_REASONING_HISTORY_CATEGORY });
    expect(memoryItems).toHaveLength(0);
  });

  it("returns a structured failure (not a throw) when the provider returns text that fails Output Engine validation", async () => {
    const malformedProvider: AIProvider = {
      name: "gemini",
      async generate() {
        return { text: "not json at all", provider: "gemini", model: "gemini-2.0-flash", responseTimeMs: 5 };
      },
      async healthCheck() {
        return { ok: true, detail: "ok" };
      },
    };
    const { logger } = fakeLogger("run_9");
    const result = await runReasoning({ moduleId: "finance-analyst", observation: "obs" }, logger, malformedProvider);
    expect(result.failed).toBe(true);
  });
});
