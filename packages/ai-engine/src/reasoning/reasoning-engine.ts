import {
  computeBackoffMs,
  generateId,
  getConfig,
  sleep,
  type AIModuleId,
  type AIReasoningLogEntry,
  type AIProviderName,
  type ApprovalLevel,
  type ConversationLogEntry,
  type GovernanceProfile,
  type ReasoningOutput,
  type ReasoningResult,
} from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { KnowledgeBase } from "@mkh/memory";
import { getGovernanceProfile } from "@mkh/security";
import { AIProviderError, getAIProvider, type AIProvider } from "@mkh/ai-provider";
import type { WorkLogger } from "../core/work-logger";
import { buildSystemPrompt, buildUserPrompt } from "./prompt-engine";
import { getPromptDefinition } from "./prompt-engine";
import { AI_REASONING_HISTORY_CATEGORY, retrieveKnowledge, retrieveMemory } from "./retrieval";
import { parseReasoningOutput } from "./output-schema";
import { buildNotificationObject } from "./notification-object";

export interface ReasoningInput {
  moduleId: AIModuleId;
  /** What happened — normally the deterministic AIReport.summary the employee's own logic.ts already computed. */
  observation: string;
  /** Structured deterministic data relevant to this decision — the "Collect Context" step's material. Kept small; this is not the whole AIReport.data. */
  contextData?: Record<string, unknown>;
  /** Optional keyword hint for the Retrieval Layer; defaults to `observation`. */
  knowledgeQuery?: string;
}

/**
 * Governance is enforced here, deterministically — never by trusting the
 * model's own `needApproval` self-report at face value. If the model says
 * approval is needed, the level is the worker's declared
 * `requiresApprovalLevel` (or, if that worker has none declared, its
 * `permissionLevel` ceiling); otherwise it's the worker's `autoActionLevel`.
 * Either way the result is hard-clamped to `permissionLevel` — "No AI
 * Worker may execute actions above its permission level" holds by
 * construction, not by convention. See docs/AI_GOVERNANCE.md.
 */
export function determineApprovalLevel(profile: GovernanceProfile, output: ReasoningOutput): ApprovalLevel {
  const rawLevel = output.needApproval ? (profile.requiresApprovalLevel ?? profile.permissionLevel) : profile.autoActionLevel;
  return Math.min(rawLevel, profile.permissionLevel) as ApprovalLevel;
}

/**
 * The Reasoning Engine — every Digital Employee's "kemampuan berpikir"
 * runs through this one function, in this fixed order: Observe -> Collect
 * Context -> Retrieve Memory -> Retrieve Knowledge -> Reason -> Generate
 * Recommendation (the Output Engine's parsed result) -> Determine Approval
 * Level -> Generate Notification -> Audit -> Save Memory.
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

  // 3. Retrieve Memory (this employee's own past reasoning outputs only)
  const memory = await retrieveMemory(repo, input.moduleId);
  await log.step("reasoning_retrieve_memory", `${memory.length} item memory (riwayat reasoning sendiri) diambil`);

  // 4. Retrieve Knowledge (top-K only — never the whole knowledge base)
  const knowledge = await retrieveKnowledge(repo, { moduleId: input.moduleId, query: input.knowledgeQuery ?? input.observation });
  await log.step("reasoning_retrieve_knowledge", `${knowledge.length} item knowledge relevan diambil`);

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
  /** The last raw provider response text seen, success or not — feeds the ConversationLogEntry below so a failed/malformed reasoning attempt is still replayable for debugging, not just the successful ones. */
  let lastResponseText = "";

  for (; attempt < config.AI_RETRY_ATTEMPTS; attempt++) {
    try {
      const provider = providerOverride ?? getAIProvider();
      providerName = provider.name;
      const response = await provider.generate({ systemPrompt, userPrompt, responseFormat: "json" });
      totalResponseTimeMs += response.responseTimeMs;
      modelUsed = response.model;
      tokenUsage = response.tokensUsed ?? {};
      lastResponseText = response.text;

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
      await sleep(computeBackoffMs(config.AI_RETRY_BACKOFF_MS, attempt));
    }
  }

  // 8-9. Determine Approval Level -> Generate Notification (only meaningful on success).
  let governedOutput: (ReasoningOutput & { approvalLevel: ApprovalLevel; notification: ReturnType<typeof buildNotificationObject> }) | undefined;
  if (success && parsedOutput) {
    const governanceProfile = getGovernanceProfile(input.moduleId);
    const approvalLevel = determineApprovalLevel(governanceProfile, parsedOutput);
    await log.step("reasoning_determine_approval_level", `Approval level: ${approvalLevel} (${input.moduleId} ceiling: ${governanceProfile.permissionLevel})`);

    const notification = buildNotificationObject(input.moduleId, parsedOutput, approvalLevel);
    await log.step("reasoning_generate_notification", `Notification object dibuat untuk ${notification.recipient} (priority: ${notification.priority})`);

    governedOutput = { ...parsedOutput, approvalLevel, notification };
  }

  // Conversation log (Sprint 3B) — the verbatim prompt/response exchange, kept
  // separate from the metadata-only audit log below so a specific decision can
  // be replayed/debugged without bloating routine audit-log queries. Only
  // written when the provider actually returned text — a total connection
  // failure (no response at all) has nothing worth persisting here.
  if (lastResponseText) {
    const conversationLog: ConversationLogEntry = {
      id: generateId("conv"),
      moduleId: input.moduleId,
      runId,
      systemPrompt,
      userPrompt,
      responseText: lastResponseText,
      createdAt: new Date().toISOString(),
    };
    await repo.saveConversationLog(conversationLog);
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

  if (!success || !parsedOutput || !governedOutput) {
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

  return { ...governedOutput, failed: false };
}
