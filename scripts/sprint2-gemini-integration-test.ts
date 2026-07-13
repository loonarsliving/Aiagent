/**
 * Sprint 2 Phase 11 — live Gemini connectivity + integration test.
 * Run with: npx tsx --env-file=.env scripts/sprint2-gemini-integration-test.ts
 * Requires GEMINI_API_KEY to be set in .env (never hardcoded, never committed).
 */
import { getAIProvider, resetAIProviderCache } from "@mkh/ai-provider";
import { getRepository, resetRepositoryCache } from "@mkh/database";
import { createWorkLogger } from "@mkh/ai-engine";
import { runReasoning } from "@mkh/ai-engine";

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

async function main(): Promise<void> {
  let passed = 0;
  let failed = 0;

  function check(label: string, ok: boolean, detail?: string): void {
    if (ok) {
      passed++;
      console.log(`  PASS — ${label}`);
    } else {
      failed++;
      console.log(`  FAIL — ${label}${detail ? ` (${detail})` : ""}`);
    }
  }

  resetAIProviderCache();
  resetRepositoryCache();

  section("1. Provider resolution");
  const provider = getAIProvider();
  check("getAIProvider() resolves to gemini", provider.name === "gemini", `got ${provider.name}`);

  section("2. Health check (live call to Gemini)");
  const health = await provider.healthCheck();
  console.log(`  detail: ${health.detail}`);
  check("healthCheck().ok === true", health.ok === true, health.detail);

  if (!health.ok) {
    console.log("\nHealth check failed — aborting integration test (key likely invalid or unreachable).");
    console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
    process.exit(1);
  }

  section("3. Raw generate() call");
  const raw = await provider.generate({
    systemPrompt: "Anda adalah asisten AI. Jawab HANYA dengan satu objek JSON: {\"ok\": true}.",
    userPrompt: "Konfirmasi Anda bisa membaca instruksi ini.",
    responseFormat: "json",
    maxOutputTokens: 64,
  });
  console.log(`  model: ${raw.model}, responseTimeMs: ${raw.responseTimeMs}, tokensUsed: ${JSON.stringify(raw.tokensUsed)}`);
  check("generate() returns non-empty text", raw.text.trim().length > 0);
  check("generate() reports a model name", raw.model.length > 0);
  check("generate() reports responseTimeMs > 0", raw.responseTimeMs > 0);

  section("4. Full Reasoning Engine pipeline (runReasoning) against a real employee");
  const workLog = createWorkLogger("finance-analyst", "run_gemini_it_1", "daily");
  const stepsSeen: string[] = [];
  const originalStep = workLog.step.bind(workLog);
  workLog.step = async (step, detail, status) => {
    stepsSeen.push(step);
    return originalStep(step, detail, status);
  };

  const result = await runReasoning(
    {
      moduleId: "finance-analyst",
      observation: "Net cashflow positif Rp15.000.000, proyeksi 7 hari ke depan Rp20.000.000, 1 transaksi tidak biasa terdeteksi.",
      contextData: { netCashflowIdr: 15_000_000, cashflowProjectionNext7dIdr: 20_000_000, anomalyCount: 1 },
    },
    workLog,
  );

  console.log(`  result: ${JSON.stringify(result)}`);
  check("runReasoning() does not throw", true);
  check("result.failed is falsy (real Gemini call succeeded end-to-end)", !result.failed, result.failed ? result.reason : undefined);
  check(
    "work log ran the full Observe->...->Save Memory sequence",
    stepsSeen.includes("reasoning_observe") &&
      stepsSeen.includes("reasoning_collect_context") &&
      stepsSeen.includes("reasoning_retrieve_knowledge") &&
      stepsSeen.includes("reasoning_retrieve_memory") &&
      stepsSeen.includes("reasoning_audit_log"),
    stepsSeen.join(","),
  );

  if (!result.failed) {
    check("output has a valid priority", ["low", "medium", "high", "urgent"].includes(result.priority));
    check("output has a non-empty summary", result.summary.trim().length > 0);
    check("output has a non-empty recommendation", result.recommendation.trim().length > 0);
    check("output has a confidenceScore in [0,1]", result.confidenceScore >= 0 && result.confidenceScore <= 1);
    check("output has a boolean needApproval", typeof result.needApproval === "boolean");
  }

  section("5. Audit log persisted");
  const logs = await getRepository().listAIReasoningLogs({ moduleId: "finance-analyst", runId: "run_gemini_it_1" });
  check("exactly one AIReasoningLogEntry saved for this run", logs.length === 1, `got ${logs.length}`);
  if (logs[0]) {
    console.log(`  audit entry: ${JSON.stringify(logs[0])}`);
    check("audit entry provider === gemini", logs[0].provider === "gemini");
    check("audit entry status === success", logs[0].status === "success", logs[0].errorReason);
  }

  section("6. Memory persisted (own reasoning history)");
  const memoryItems = await getRepository().listKnowledgeItems({ moduleId: "finance-analyst", category: "ai-reasoning-history" });
  check("reasoning output saved to finance-analyst's own memory", memoryItems.length === 1, `got ${memoryItems.length}`);

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Integration test crashed:", err);
  process.exit(1);
});
