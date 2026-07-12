import { generateId, getConfig, type AIModuleId, type AIReasoningLogEntry, type AIProviderName, type ReasoningResult } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { KnowledgeBase } from "@mkh/memory";
import { AIProviderError, getAIProvider, type AIProvider } from "@mkh/ai-provider";
import type { WorkLogger } from "../core/work-logger";
import { buildSystemPrompt, buildUserPrompt } from "./prompt-engine";
import { getPromptDefinition } from "./prompt-engine";
import { AI_REASONING_HISTORY_CATEGORY, retrieveKnowledge, retrieveMemory } from "./retrieval";
import { parseReasoningOutput } from "./output-schema";

export interface ReasoningInput {
  moduleId: AIModuleId;
  /** What happened — normally the deterministic AIReport.summary the employee's own logic.ts already computed. */
  observation: string;
  /** Structured deterministic data relevant to this decision — the "Collect Context" step's material. Kept small; this is not the whole AIReport.data. */
  contextData?: Record<string, unknown>;
  /** Optional keyword hint for the Retrieval Layer; defaults to `observation`. */
  knowledgeQuery?: string;
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/**
 * The Reasoning Engine — every Digital Employee's "kemampuan berpikir"
 * runs through this one function, in this fixed order: Observe -> Collect
 * Context -> Retrieve Knowledge -> Retrieve Memory -> Reason -> Decision/
 * Recommendation/Confidence/NeedApproval (the Output Engine's parsed
 * result) -> Audit Log -> save to own memory.
 *
 * Error handling matches the brief exactly: retry (bounded,
 * AI_RETRY_ATTEMPTS/AI_RETRY_BACKOFF_MS) -> on exhaustion, write the audit
 * log -> return a structured ReasoningFailure. This function NEVER throws
 * to its caller — same "never throw to the employee" guarantee Sprint 1's
 * runEmployeeTask established for the whole task, now also true one layer
 * down for reasoning specifically.
 */
export async function runReasoning(
  input: ReasoningInput,
  log: WorkLogger,
  /** Test-only injection point — production callers omit this and get getAIProvider()'s config-resolved provider. */
  providerOverride?: AIProvider,
): Promise<ReasoningResult> {
  const repo = getRepository();
  const config = getConfig();
  const promptDefinition = getPromptDefinition(input.moduleId);
  const runId = log.runId;

  // 1. Observe
  await log.step("reasoning_observe", "Mengamati hasil kerja hari ini");

  // 2. Collect Context
  await log.step("reasoning_collect_context", "Mengumpulkan konteks & data terkait");

  // 3. Retrieve Knowledge (top-K only — never the whole knowledge base)
  const knowledge = await retrieveKnowledge(repo, { moduleId: input.moduleId, query: input.knowledgeQuery ?? input.observation });
  await log.step("reasoning_retrieve_knowledge", `${knowledge.length} item knowledge relevan diambil`);

  // 4. Retrieve Memory (this employee's own past reasoning outputs only)
  const memory = await retrieveMemory(repo, input.moduleId);
  await log.step("reasoning_retrieve_memory", `${memory.length} item memory (riwayat reasoning sendiri) diambil`);

  const systemPrompt = buildSystemPrompt(promptDefinition);
  const userPrompt = buildUserPrompt({ observation: input.observation, contextData: input.contextData, knowledge, memory });

  // 5-7. Reason -> Decision/Recommendation/Confidence/NeedApproval, with bounded retry.
  let attempt = 0;
  let success = false;
  let lastErrorReason = "unknown error";
  let totalResponseTimeMs = 0;
  let providerName: AIProviderName = config.AI_PROVIDER;
  let modelUsed = "unknown";
  let tokenUsage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } = {};
  let parsedOutput: ReturnType<typeof parseReasoningOutput>["output"];

  for (; attempt < config.AI_RETRY_ATTEMPTS; attempt++) {
    try {
      const provider = providerOverride ?? getAIProvider();
      providerName = provider.name;
      const response = await provider.generate({ systemPrompt, userPrompt, responseFormat: "json" });
      totalResponseTimeMs += response.responseTimeMs;
      modelUsed = response.model;
      tokenUsage = response.tokensUsed ?? {};

      const parsed = parseReasoningOutput(response.text);
      if (!parsed.success || !parsed.output) {
        throw new Error(parsed.error ?? "Failed to parse reasoning output");
      }
      parsedOutput = parsed.output;
      success = true;
      break;
    } catch (err) {
      lastErrorReason = err instanceof Error ? err.message : String(err);
      const nonRetryable = err instanceof AIProviderError && !err.retryable;
      const isLastAttempt = attempt === config.AI_RETRY_ATTEMPTS - 1;

      if (isLastAttempt || nonRetryable) {
        await log.step(
          "reasoning_reason",
          nonRetryable ? `Reasoning gagal (non-retryable): ${lastErrorReason}` : `Reasoning gagal setelah ${attempt + 1} percobaan: ${lastErrorReason}`,
          "error",
        );
        break;
      }

      await log.step("reasoning_reason", `Percobaan ${attempt + 1} gagal: ${lastErrorReason}. Mencoba lagi...`, "retry");
      await sleep(config.AI_RETRY_BACKOFF_MS * 2 ** attempt);
    }
  }

  // 10. Audit Log — one row per reasoning attempt sequence, success or failure either way.
  const auditEntry: AIReasoningLogEntry = {
    id: generateId("ail"),
    moduleId: input.moduleId,
    runId,
    provider: providerName,
    model: modelUsed,
    status: success ? "success" : "error",
    responseTimeMs: totalResponseTimeMs,
    promptTokens: tokenUsage.promptTokens,
    completionTokens: tokenUsage.completionTokens,
    totalTokens: tokenUsage.totalTokens,
    retryCount: attempt,
    errorReason: success ? undefined : lastErrorReason,
    createdAt: new Date().toISOString(),
  };
  await repo.saveAIReasoningLog(auditEntry);

  if (!success || !parsedOutput) {
    await log.step("reasoning_audit_log", `Audit log disimpan (status=error): ${lastErrorReason}`, "error");
    return { failed: true, reason: lastErrorReason };
  }

  await log.step("reasoning_audit_log", `Audit log disimpan (status=success, provider=${providerName}, retry=${attempt})`);

  // Save to this employee's own memory — continuity for the next run, never shared with another employee.
  const kb = new KnowledgeBase(repo);
  await kb.remember([
    {
      id: `${input.moduleId}:${AI_REASONING_HISTORY_CATEGORY}:${runId}`,
      moduleId: input.moduleId,
      category: AI_REASONING_HISTORY_CATEGORY,
      title: parsedOutput.summary,
      metadata: {
        priority: parsedOutput.priority,
        confidenceScore: parsedOutput.confidenceScore,
        needApproval: parsedOutput.needApproval,
        recommendation: parsedOutput.recommendation,
      },
    },
  ]);
  await log.step("reasoning_save_memory", "Hasil reasoning disimpan ke memory sendiri");

  return { ...parsedOutput, failed: false };
}
