/**
 * Sprint 1 Gate Review — Acceptance Test.
 *
 * Exercises the REAL system (real runEmployeeTask, real Repository, real
 * WorkLogger, real notify()) against DATA_MODE=dummy — nothing in this
 * script is mocked beyond what the system already mocks for itself
 * (connectors). Run with:
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/sprint1-acceptance-test.ts
 *
 * Exits non-zero if any of the 10 acceptance criteria fail.
 */
import {
  AI_MODULE_IDS,
  generateId,
  resetConfigCache,
  type AIModuleId,
  type AIReport,
  type AIRunContext,
  type TaskCadence,
} from "@mkh/shared";
import { getRepository, resetRepositoryCache } from "@mkh/database";
import {
  EMPLOYEE_REGISTRY,
  runEmployeeTask,
  type AIEmployee,
  type WorkLogger,
} from "@mkh/ai-engine";
import { KnowledgeBase } from "@mkh/memory";
import { runScheduledTask, toCronExpression, triggerEmployee } from "@mkh/scheduler";

interface CriterionResult {
  id: string;
  title: string;
  pass: boolean;
  evidence: string[];
}

const results: CriterionResult[] = [];

function record(id: string, title: string, pass: boolean, evidence: string[]) {
  results.push({ id, title, pass, evidence });
  console.log(`\n${pass ? "✅ PASS" : "❌ FAIL"} — Criterion ${id}: ${title}`);
  for (const line of evidence) console.log(`   ${line}`);
}

async function main() {
  resetRepositoryCache();
  resetConfigCache();
  const repo = getRepository();

  // ================= Criterion 1: Manual Trigger =================
  // Explicit order chosen only for deterministic downstream evidence
  // (e.g. SOP Guardian runs before anyone else so it observes real
  // missed-run state; Marketing Intelligence before Meta Ads Specialist
  // so a real opportunity exists to draft a campaign from). The ORDER is
  // test orchestration, not a workflow-engine hardcode — see Criterion 7.
  const triggerOrder: AIModuleId[] = [
    "sop-guardian",
    "marketing-intelligence",
    "content-planner",
    "meta-ads-specialist",
    "sales-supervisor",
    "branch-performance-manager",
    "finance-analyst",
    "hr-officer",
    "ota-manager",
    "ceo-assistant",
  ];
  if (new Set(triggerOrder).size !== AI_MODULE_IDS.length || !AI_MODULE_IDS.every((id) => triggerOrder.includes(id))) {
    throw new Error("triggerOrder must be a permutation of AI_MODULE_IDS — test setup bug");
  }

  const triggerRuns: Record<string, { status: string; runId: string; reportId?: string }> = {};
  for (const moduleId of triggerOrder) {
    const run = await triggerEmployee({ moduleId, cadence: "daily", requestedBy: "acceptance-test:cli" });
    triggerRuns[moduleId] = { status: run.status, runId: run.id, reportId: run.reportId };
  }
  const allManualTriggersOk = AI_MODULE_IDS.every((id) => triggerRuns[id]?.status === "success");
  record(
    "1",
    "Seluruh Digital Employee dapat dijalankan melalui Manual Trigger",
    allManualTriggersOk,
    [
      `triggerEmployee() called individually for all ${AI_MODULE_IDS.length} AI_MODULE_IDS (daily cadence).`,
      ...Object.entries(triggerRuns).map(([id, r]) => `  - ${id}: status=${r.status} scheduleRunId=${r.runId} reportId=${r.reportId}`),
    ],
  );

  // ================= Criterion 2: Scheduler runs everyone per schedule, no hardcode =================
  const entries = await repo.listScheduleEntries();
  const expectedCadences: TaskCadence[] = ["daily", "weekly", "monthly"];
  const scheduleCoversEveryone = AI_MODULE_IDS.every((id) =>
    expectedCadences.every((c) => entries.some((e) => e.moduleId === id && e.cadence === c)),
  );
  const exactly30 = entries.length === AI_MODULE_IDS.length * expectedCadences.length;

  let cronGenerationOk = true;
  const cronFailures: string[] = [];
  for (const e of entries) {
    try {
      toCronExpression(e);
    } catch (err) {
      cronGenerationOk = false;
      cronFailures.push(`${e.id}: ${String(err)}`);
    }
  }

  // Run EVERY schedule entry through the real scheduler path (runScheduledTask),
  // picked straight from listScheduleEntries() data — no employee id is
  // literally written in this loop.
  const scheduledRuns: { id: string; moduleId: string; cadence: string; status: string }[] = [];
  for (const entry of entries) {
    const run = await runScheduledTask(entry);
    scheduledRuns.push({ id: entry.id, moduleId: entry.moduleId, cadence: entry.cadence, status: run.status });
  }
  const allScheduledOk = scheduledRuns.every((r) => r.status === "success");

  record(
    "2",
    "Scheduler mampu menjalankan seluruh Digital Employee sesuai jadwal (data-driven)",
    scheduleCoversEveryone && exactly30 && cronGenerationOk && allScheduledOk,
    [
      `listScheduleEntries() returned ${entries.length} entries (expected ${AI_MODULE_IDS.length} employees x 3 cadences = 30).`,
      `Every AI_MODULE_ID has a daily+weekly+monthly slot: ${scheduleCoversEveryone}.`,
      `toCronExpression() succeeded for all ${entries.length} entries with zero exceptions: ${cronGenerationOk}${cronFailures.length ? ` (failures: ${cronFailures.join("; ")})` : ""}.`,
      `runScheduledTask() executed for all ${scheduledRuns.length} schedule entries (the actual cron-triggered codepath, not manual trigger) — ${scheduledRuns.filter((r) => r.status === "success").length}/${scheduledRuns.length} succeeded.`,
      ...scheduledRuns.filter((r) => r.status !== "success").map((r) => `  FAILED: ${r.moduleId}/${r.cadence} (${r.id})`),
    ],
  );

  // ================= Criterion 3: Notification Engine receives events from all =================
  const notifications = await repo.listNotifications(500);
  const notifiedModuleIds = new Set(notifications.map((n) => n.sourceModuleId).filter(Boolean));
  const missingNotifiers = AI_MODULE_IDS.filter((id) => !notifiedModuleIds.has(id));
  record(
    "3",
    "Notification Engine menerima event dari seluruh Digital Employee",
    missingNotifiers.length === 0,
    [
      `${notifications.length} NotificationMessage rows persisted so far.`,
      `Distinct sourceModuleId values seen: ${Array.from(notifiedModuleIds).sort().join(", ")}`,
      missingNotifiers.length > 0
        ? `MISSING notifications from: ${missingNotifiers.join(", ")}`
        : `All ${AI_MODULE_IDS.length} employees have raised at least one notification via notify() (the single Notification Coordinator funnel).`,
    ],
  );

  // ================= Criterion 5 & 6: Memory / Knowledge Base used by each employee =================
  const memoryByModule: Record<string, number> = {};
  for (const moduleId of AI_MODULE_IDS) {
    const items = await repo.listKnowledgeItems({ moduleId }, 1000);
    memoryByModule[moduleId] = items.length;
  }
  const emptyMemory = AI_MODULE_IDS.filter((id) => memoryByModule[id] === 0);
  record(
    "5",
    "Memory benar-benar digunakan oleh masing-masing Digital Employee",
    emptyMemory.length === 0,
    [
      ...AI_MODULE_IDS.map((id) => `  - ${id}: ${memoryByModule[id]} knowledge_items`),
      emptyMemory.length > 0 ? `EMPTY memory for: ${emptyMemory.join(", ")}` : "Every employee has written at least one KnowledgeItem to its own memory.",
    ],
  );

  // Knowledge base is the same underlying mechanism; prove no cross-contamination
  // (an employee's recall() never returns another employee's items).
  const sample = await new KnowledgeBase(repo).recall("marketing-intelligence", undefined, 1000);
  const crossContaminated = sample.some((item) => item.moduleId !== "marketing-intelligence");
  record(
    "6",
    "Knowledge Base benar-benar digunakan (scoped per employee, tidak bocor)",
    sample.length > 0 && !crossContaminated,
    [
      `KnowledgeBase.recall("marketing-intelligence") returned ${sample.length} items, all with moduleId === "marketing-intelligence": ${!crossContaminated}.`,
      `Categories present: ${Array.from(new Set(sample.map((i) => i.category))).join(", ")}`,
    ],
  );

  // ================= Criterion 4 (partial): logging start/finish/duration/status so far =================
  const workLogSoFar = await repo.listWorkLog({}, 2000);
  const reportsSoFar = await repo.listReports(undefined, 500);
  const hasStarted = workLogSoFar.some((w) => w.step === "started");
  const hasFinished = workLogSoFar.some((w) => w.step === "finished");
  const allReportsHaveDuration = reportsSoFar.length > 0 && reportsSoFar.every((r) => typeof r.durationMs === "number");
  const allReportsHaveRetryCount = reportsSoFar.length > 0 && reportsSoFar.every((r) => typeof r.retryCount === "number");
  const statusValuesSeen = new Set(workLogSoFar.map((w) => w.status));

  // ================= Criterion 7: Workflow Engine runs everyone without hardcode =================
  const registryKeys = Object.keys(EMPLOYEE_REGISTRY).sort();
  const moduleIdsSorted = [...AI_MODULE_IDS].sort();
  const registryMatchesModuleIds = JSON.stringify(registryKeys) === JSON.stringify(moduleIdsSorted);

  // Use listRecentReports(moduleId, "daily", 1) rather than getLatestReport()
  // here — getLatestReport() is cadence-agnostic and Criterion 2 already ran
  // every employee's weekly AND monthly slot too, so the "latest" report for
  // sop-guardian/branch-performance-manager by this point is a monthly
  // recap, not the daily report whose shape this check needs.
  const [sopGuardianReport] = await repo.listRecentReports("sop-guardian", "daily", 1);
  const sopGuardianData = sopGuardianReport?.data as { employeesChecked?: number } | undefined;
  const sopGuardianWatchesAllButSelf = sopGuardianData?.employeesChecked === AI_MODULE_IDS.length - 1;

  const salesSnapshot = await repo.getSalesSnapshot();
  const expectedBranches = new Set(salesSnapshot.reps.map((r) => r.branch));
  const [bpmReport] = await repo.listRecentReports("branch-performance-manager", "daily", 1);
  const bpmData = bpmReport?.data as { branches?: { branch: string }[] } | undefined;
  const actualBranches = new Set((bpmData?.branches ?? []).map((b) => b.branch));
  const branchesAreDataDriven =
    expectedBranches.size > 0 &&
    expectedBranches.size === actualBranches.size &&
    Array.from(expectedBranches).every((b) => actualBranches.has(b));

  record(
    "7",
    "Workflow Engine mampu menjalankan seluruh Digital Employee tanpa hardcode",
    registryMatchesModuleIds && sopGuardianWatchesAllButSelf && branchesAreDataDriven,
    [
      `EMPLOYEE_REGISTRY keys exactly equal AI_MODULE_IDS (both derived from the same source, not two separately maintained lists): ${registryMatchesModuleIds}.`,
      `SOP Guardian's watch list is computed as AI_MODULE_IDS.filter(id => id !== "sop-guardian") at runtime — employeesChecked=${sopGuardianData?.employeesChecked}, expected=${AI_MODULE_IDS.length - 1}: ${sopGuardianWatchesAllButSelf}.`,
      `Branch Performance Manager's branch list is derived purely from sales data (getSalesSnapshot), not a hardcoded array — data branches=[${Array.from(expectedBranches).join(", ")}], report branches=[${Array.from(actualBranches).join(", ")}]: ${branchesAreDataDriven}.`,
    ],
  );

  // ================= Criterion 8: Retry Strategy actually works =================
  process.env.MAX_RETRY_ATTEMPTS = "3";
  process.env.RETRY_BACKOFF_MS = "5";
  resetConfigCache();

  let flakyCalls = 0;
  const flakyEmployee: AIEmployee<{ ok: true }> = {
    id: "finance-analyst",
    name: "Acceptance-Test Flaky Employee",
    role: "test",
    description: "Fails twice, then succeeds — proves the retry loop.",
    sop: {},
    async runDaily(_ctx: AIRunContext, _log: WorkLogger): Promise<AIReport<{ ok: true }>> {
      flakyCalls += 1;
      if (flakyCalls <= 2) throw new Error(`acceptance-test simulated transient failure #${flakyCalls}`);
      return {
        id: generateId("rpt"),
        moduleId: "finance-analyst",
        cadence: "daily",
        generatedAt: new Date().toISOString(),
        status: "success",
        summary: `succeeded on attempt ${flakyCalls}`,
        data: { ok: true },
      };
    },
  };
  const flakyReport = await runEmployeeTask(flakyEmployee, "daily", { triggeredBy: "manual", requestedBy: "acceptance-test:retry" });
  const retryWorkLog = await repo.listWorkLog({ moduleId: "finance-analyst" }, 50);
  const retryStepsForThisRun = retryWorkLog.filter((w) => w.status === "retry");
  const retryWorked =
    flakyReport.status === "success" &&
    flakyReport.retryCount === 2 &&
    flakyCalls === 3 &&
    retryStepsForThisRun.length >= 2 &&
    typeof flakyReport.durationMs === "number";
  record(
    "8",
    "Retry Strategy benar-benar bekerja saat terjadi kegagalan",
    retryWorked,
    [
      `Synthetic employee configured to throw on attempts 1-2 and succeed on attempt 3 (MAX_RETRY_ATTEMPTS=3).`,
      `Actual calls made to runDaily(): ${flakyCalls} (expected 3).`,
      `Final AIReport: status=${flakyReport.status}, retryCount=${flakyReport.retryCount}, durationMs=${flakyReport.durationMs}.`,
      `Work log contains ${retryStepsForThisRun.length} entries with status="retry" for this run.`,
      `No exception propagated to the caller — runEmployeeTask returned normally despite 2 real thrown errors.`,
    ],
  );

  // ================= Criterion 9: Error Handling -> correct audit log =================
  const alwaysFailsEmployee: AIEmployee<{ ok: true }> = {
    id: "finance-analyst",
    name: "Acceptance-Test Always-Fails Employee",
    role: "test",
    description: "Always throws — proves exhausted-retry error handling and audit log.",
    sop: {},
    async runDaily(): Promise<AIReport<{ ok: true }>> {
      throw new Error("acceptance-test deliberate permanent failure");
    },
  };
  const failReport = await runEmployeeTask(alwaysFailsEmployee, "daily", { triggeredBy: "manual", requestedBy: "acceptance-test:error" });
  const persistedFailReport = await repo.getLatestReport("finance-analyst");
  const failWorkLog = await repo.listWorkLog({ moduleId: "finance-analyst" }, 10);
  const lastFailStep = failWorkLog[0]; // most-recent-first
  const errorHandledCorrectly =
    failReport.status === "error" &&
    failReport.error === "acceptance-test deliberate permanent failure" &&
    persistedFailReport?.status === "error" &&
    persistedFailReport?.id === failReport.id &&
    lastFailStep?.status === "error" &&
    lastFailStep?.step === "finished";

  // Confirm SOP Guardian, run again now, actually flags this failure — proves
  // the audit log is not just written but actually consumed downstream.
  const sopGuardianRerun = await runEmployeeTask(EMPLOYEE_REGISTRY["sop-guardian"] as AIEmployee<unknown>, "daily", {
    triggeredBy: "manual",
    requestedBy: "acceptance-test:verify-audit",
  });
  const sopGuardianRerunData = sopGuardianRerun.data as { violations?: { moduleId: string; violationType: string }[] };
  const guardianCaughtTheFailure = (sopGuardianRerunData.violations ?? []).some(
    (v) => v.moduleId === "finance-analyst" && v.violationType === "run_failed",
  );

  record(
    "9",
    "Error Handling menghasilkan audit log yang benar",
    errorHandledCorrectly && guardianCaughtTheFailure,
    [
      `Synthetic employee always throws "acceptance-test deliberate permanent failure".`,
      `runEmployeeTask returned (did not reject): status=${failReport.status}, error="${failReport.error}".`,
      `Persisted report matches the in-memory one returned to the caller: ${persistedFailReport?.id === failReport.id}.`,
      `Final work log step: step="${lastFailStep?.step}" status="${lastFailStep?.status}".`,
      `SOP Guardian's next run independently reads this audit trail and flags it: violationType="run_failed" for finance-analyst = ${guardianCaughtTheFailure}.`,
    ],
  );

  // restore config
  delete process.env.MAX_RETRY_ATTEMPTS;
  delete process.env.RETRY_BACKOFF_MS;
  resetConfigCache();

  // ================= Criterion 4 (final): full logging proof, now including retry+error =================
  const finalWorkLog = await repo.listWorkLog({}, 5000);
  const finalStatusValues = new Set(finalWorkLog.map((w) => w.status));
  const requiredStatuses = ["info", "success", "error", "retry"];
  const allStatusesPresent = requiredStatuses.every((s) => finalStatusValues.has(s as never));
  const hasAttempt = finalWorkLog.every((w) => typeof w.attempt === "number" || w.attempt === undefined);
  record(
    "4",
    "Logging mencatat start, finish, duration, status, error, retry",
    hasStarted && hasFinished && allReportsHaveDuration && allReportsHaveRetryCount && allStatusesPresent,
    [
      `"started" step present: ${hasStarted}. "finished" step present: ${hasFinished}.`,
      `Every persisted AIReport (${reportsSoFar.length}+ so far) carries durationMs: ${allReportsHaveDuration} and retryCount: ${allReportsHaveRetryCount}.`,
      `WorkLogEntry.status values observed across the run: ${Array.from(finalStatusValues).sort().join(", ")} — all 4 required values (${requiredStatuses.join(", ")}) present: ${allStatusesPresent}.`,
      `WorkLogEntry.attempt field well-formed on every entry: ${hasAttempt}.`,
      `Total work log entries persisted this run: ${finalWorkLog.length}.`,
    ],
  );

  // ================= Summary =================
  console.log("\n" + "=".repeat(70));
  console.log("ACCEPTANCE TEST SUMMARY");
  console.log("=".repeat(70));
  for (const r of results.sort((a, b) => Number(a.id) - Number(b.id))) {
    console.log(`${r.pass ? "✅" : "❌"} Criterion ${r.id}: ${r.title}`);
  }
  const allPass = results.every((r) => r.pass);
  console.log("\n" + (allPass ? "ALL CRITERIA PASSED" : "ONE OR MORE CRITERIA FAILED"));
  process.exitCode = allPass ? 0 : 1;
}

main().catch((err) => {
  console.error("Acceptance test crashed:", err);
  process.exitCode = 1;
});
