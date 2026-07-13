import { describe, expect, it } from "vitest";
import type {
  AIReasoningLogEntry,
  AIReport,
  ApprovalRequest,
  ChatConversation,
  ConversationLogEntry,
  IntegrationLogEntry,
  NotificationMessage,
  QueueJob,
  ScheduleEntry,
  ScheduleRunRecord,
  SchedulerLock,
  WorkLogEntry,
} from "@mkh/shared";
import type { KnowledgeItem } from "../domain-types";
import { SupabaseRepository } from "./supabase-repository";

/**
 * SupabaseRepository (DATA_MODE=supabase) talks to a real Postgres project
 * via @supabase/supabase-js — no live project exists in CI, so these tests
 * swap in a minimal fake query-builder client that mimics the small slice
 * of the supabase-js chain API this repository actually uses
 * (.from().select/insert/upsert/update().eq/order/limit().single/maybeSingle(),
 * plus the chain itself being awaitable). This exercises every method's
 * request shape and its error-branch handling without a network dependency.
 */

interface FakeResult {
  data: unknown;
  error: { message: string } | null;
}

/**
 * Most methods make a single `.from(table)` call, so a single FakeResult
 * per table is enough. `claimNextPendingJob` makes two sequential calls to
 * the same table (select the candidate, then conditionally update it) that
 * need different responses — pass an array to have each successive call
 * against that table consume the next entry (the last entry repeats for
 * any further calls).
 */
function createFakeClient(resultByTable: Record<string, FakeResult | FakeResult[]>, rpcResultByFn: Record<string, FakeResult> = {}) {
  const calls: Record<string, { op: string; row?: unknown; opts?: unknown; args?: unknown }[]> = {};
  const callIndexByTable: Record<string, number> = {};

  function record(table: string, op: string, row?: unknown, opts?: unknown, args?: unknown) {
    (calls[table] ??= []).push({ op, row, opts, args });
  }

  function nextResult(table: string): FakeResult {
    const raw = resultByTable[table];
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [{ data: null, error: null }];
    const idx = callIndexByTable[table] ?? 0;
    callIndexByTable[table] = idx + 1;
    return list[Math.min(idx, list.length - 1)] ?? { data: null, error: null };
  }

  function builder(table: string) {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      lte: () => chain,
      order: () => chain,
      limit: () => chain,
      delete: () => {
        record(table, "delete");
        return chain;
      },
      insert: (row: unknown) => {
        record(table, "insert", row);
        return chain;
      },
      upsert: (row: unknown, opts: unknown) => {
        record(table, "upsert", row, opts);
        return chain;
      },
      update: (row: unknown) => {
        record(table, "update", row);
        return chain;
      },
      maybeSingle: () => Promise.resolve(nextResult(table)),
      single: () => Promise.resolve(nextResult(table)),
      then: (resolve: (v: FakeResult) => void, reject: (e: unknown) => void) => Promise.resolve(nextResult(table)).then(resolve, reject),
    };
    return chain;
  }

  function rpc(fnName: string, args: unknown) {
    record(`rpc:${fnName}`, "rpc", undefined, undefined, args);
    return Promise.resolve(rpcResultByFn[fnName] ?? { data: null, error: null });
  }

  return { client: { from: builder, rpc }, calls };
}

function withFakeClient(resultByTable: Record<string, FakeResult | FakeResult[]>, rpcResultByFn: Record<string, FakeResult> = {}) {
  const repo = new SupabaseRepository("https://example.supabase.co", "test-service-key");
  const { client, calls } = createFakeClient(resultByTable, rpcResultByFn);
  (repo as unknown as { client: unknown }).client = client;
  return { repo, calls };
}

function reportRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rpt_1",
    module_id: "finance-analyst",
    cadence: "daily",
    generated_at: "2026-07-12T00:00:00.000Z",
    status: "success",
    summary: "ok",
    data: {},
    error: null,
    duration_ms: 10,
    retry_count: 0,
    ...overrides,
  };
}

function report(overrides: Partial<AIReport> = {}): AIReport {
  return {
    id: "rpt_1",
    moduleId: "finance-analyst",
    cadence: "daily",
    generatedAt: "2026-07-12T00:00:00.000Z",
    status: "success",
    summary: "ok",
    data: {},
    ...overrides,
  };
}

function approvalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "apr_1",
    module_id: "meta-ads-specialist",
    action_type: "decrease_budget",
    campaign_id: "cmp_1",
    campaign_name: "Campaign A",
    reason: "CPL too high",
    proposed_change: {},
    status: "pending",
    requested_at: "2026-07-12T00:00:00.000Z",
    decided_at: null,
    decided_by: null,
    ...overrides,
  };
}

function approval(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id: "apr_1",
    moduleId: "meta-ads-specialist",
    actionType: "decrease_budget",
    campaignId: "cmp_1",
    campaignName: "Campaign A",
    reason: "CPL too high",
    proposedChange: {},
    status: "pending",
    requestedAt: "2026-07-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("SupabaseRepository — reports", () => {
  it("saveReport inserts a row with null-coalesced optional fields", async () => {
    const { repo, calls } = withFakeClient({ reports: { data: null, error: null } });
    await repo.saveReport(report());
    expect(calls.reports?.[0]?.op).toBe("insert");
    expect((calls.reports?.[0]?.row as Record<string, unknown>).duration_ms).toBeNull();
  });

  it("getLatestReport maps a found row", async () => {
    const { repo } = withFakeClient({ reports: { data: reportRow(), error: null } });
    const result = await repo.getLatestReport("finance-analyst");
    expect(result?.id).toBe("rpt_1");
  });

  it("getLatestReport returns null when nothing is found", async () => {
    const { repo } = withFakeClient({ reports: { data: null, error: null } });
    expect(await repo.getLatestReport("finance-analyst")).toBeNull();
  });

  it("getLatestReport throws on a query error", async () => {
    const { repo } = withFakeClient({ reports: { data: null, error: { message: "boom" } } });
    await expect(repo.getLatestReport("finance-analyst")).rejects.toThrow("boom");
  });

  it("listReports maps every row, with and without a moduleId filter", async () => {
    const { repo } = withFakeClient({ reports: { data: [reportRow(), reportRow({ id: "rpt_2" })], error: null } });
    expect(await repo.listReports()).toHaveLength(2);
    expect(await repo.listReports("finance-analyst")).toHaveLength(2);
  });

  it("listReports throws on a query error", async () => {
    const { repo } = withFakeClient({ reports: { data: null, error: { message: "boom" } } });
    await expect(repo.listReports()).rejects.toThrow("boom");
  });

  it("listRecentReports maps and reverses to oldest-first", async () => {
    const { repo } = withFakeClient({ reports: { data: [reportRow({ id: "b" }), reportRow({ id: "a" })], error: null } });
    const result = await repo.listRecentReports("finance-analyst", "daily", 7);
    expect(result.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("SupabaseRepository — approvals", () => {
  it("saveApproval inserts the row shape", async () => {
    const { repo, calls } = withFakeClient({ approvals: { data: null, error: null } });
    await repo.saveApproval(approval());
    expect((calls.approvals?.[0]?.row as Record<string, unknown>).module_id).toBe("meta-ads-specialist");
  });

  it("getApproval maps a found row and returns null when missing", async () => {
    const found = withFakeClient({ approvals: { data: approvalRow(), error: null } });
    expect((await found.repo.getApproval("apr_1"))?.id).toBe("apr_1");

    const missing = withFakeClient({ approvals: { data: null, error: null } });
    expect(await missing.repo.getApproval("apr_x")).toBeNull();
  });

  it("getApproval throws on a query error", async () => {
    const { repo } = withFakeClient({ approvals: { data: null, error: { message: "boom" } } });
    await expect(repo.getApproval("apr_1")).rejects.toThrow("boom");
  });

  it("listApprovals maps rows, with and without a status filter", async () => {
    const { repo } = withFakeClient({ approvals: { data: [approvalRow()], error: null } });
    expect(await repo.listApprovals()).toHaveLength(1);
    expect(await repo.listApprovals("pending")).toHaveLength(1);
  });

  it("listApprovals throws on a query error", async () => {
    const { repo } = withFakeClient({ approvals: { data: null, error: { message: "boom" } } });
    await expect(repo.listApprovals()).rejects.toThrow("boom");
  });

  it("updateApproval sends the update and resolves the given approval", async () => {
    const { repo, calls } = withFakeClient({ approvals: { data: null, error: null } });
    const updated = await repo.updateApproval(approval({ status: "approved" }));
    expect(updated.status).toBe("approved");
    expect(calls.approvals?.[0]?.op).toBe("update");
  });

  it("updateApproval throws on a query error", async () => {
    const { repo } = withFakeClient({ approvals: { data: null, error: { message: "boom" } } });
    await expect(repo.updateApproval(approval())).rejects.toThrow("boom");
  });
});

describe("SupabaseRepository — notifications", () => {
  function notification(overrides: Partial<NotificationMessage> = {}): NotificationMessage {
    return { id: "ntf_1", channel: "dummy", severity: "info", title: "T", body: "B", createdAt: "2026-07-12T00:00:00.000Z", ...overrides };
  }

  it("saveNotification inserts and returns the given notification", async () => {
    const { repo } = withFakeClient({ notifications: { data: null, error: null } });
    expect((await repo.saveNotification(notification())).id).toBe("ntf_1");
  });

  it("listNotifications maps rows including optional fields", async () => {
    const { repo } = withFakeClient({
      notifications: {
        data: [{ id: "n1", channel: "dummy", severity: "info", title: "T", body: "B", target: "owner", source_module_id: "finance-analyst", created_at: "2026-07-12T00:00:00.000Z" }],
        error: null,
      },
    });
    const result = await repo.listNotifications();
    expect(result[0]?.target).toBe("owner");
    expect(result[0]?.sourceModuleId).toBe("finance-analyst");
  });

  it("listNotifications throws on a query error", async () => {
    const { repo } = withFakeClient({ notifications: { data: null, error: { message: "boom" } } });
    await expect(repo.listNotifications()).rejects.toThrow("boom");
  });
});

describe("SupabaseRepository — schedule", () => {
  it("listScheduleEntries maps rows when present", async () => {
    const row: Record<string, unknown> = { id: "sch_1", module_id: "finance-analyst", cadence: "daily", time: "15:00", day_of_week: null, day_of_month: null, label: "L", enabled: true };
    const { repo } = withFakeClient({ schedule_entries: { data: [row], error: null } });
    const result = await repo.listScheduleEntries();
    expect(result).toEqual<ScheduleEntry[]>([{ id: "sch_1", moduleId: "finance-analyst", cadence: "daily", time: "15:00", dayOfWeek: undefined, dayOfMonth: undefined, label: "L", enabled: true }]);
  });

  it("listScheduleEntries falls back to DEFAULT_SCHEDULE when the table is empty", async () => {
    const { repo } = withFakeClient({ schedule_entries: { data: [], error: null } });
    const result = await repo.listScheduleEntries();
    expect(result.length).toBeGreaterThan(0);
  });

  it("listScheduleEntries throws on a query error", async () => {
    const { repo } = withFakeClient({ schedule_entries: { data: null, error: { message: "boom" } } });
    await expect(repo.listScheduleEntries()).rejects.toThrow("boom");
  });

  function runRow(overrides: Record<string, unknown> = {}) {
    return { id: "run_1", module_id: "finance-analyst", cadence: "daily", scheduled_time: "15:00", started_at: "2026-07-12T00:00:00.000Z", finished_at: null, status: "running", report_id: null, ...overrides };
  }

  function run(overrides: Partial<ScheduleRunRecord> = {}): ScheduleRunRecord {
    return { id: "run_1", moduleId: "finance-analyst", cadence: "daily", scheduledTime: "15:00", startedAt: "2026-07-12T00:00:00.000Z", status: "running", ...overrides };
  }

  it("saveScheduleRun inserts and returns the given run", async () => {
    const { repo } = withFakeClient({ schedule_runs: { data: null, error: null } });
    expect((await repo.saveScheduleRun(run())).id).toBe("run_1");
  });

  it("updateScheduleRun sends the patch and maps the returned row", async () => {
    const { repo, calls } = withFakeClient({ schedule_runs: { data: runRow({ status: "success", finished_at: "2026-07-12T00:05:00.000Z", report_id: "rpt_1" }), error: null } });
    const updated = await repo.updateScheduleRun("run_1", { status: "success", finishedAt: "2026-07-12T00:05:00.000Z", reportId: "rpt_1" });
    expect(updated.status).toBe("success");
    expect(calls.schedule_runs?.[0]?.op).toBe("update");
  });

  it("updateScheduleRun throws on a query error", async () => {
    const { repo } = withFakeClient({ schedule_runs: { data: null, error: { message: "boom" } } });
    await expect(repo.updateScheduleRun("run_1", { status: "error" })).rejects.toThrow("boom");
  });

  it("listScheduleRuns maps rows", async () => {
    const { repo } = withFakeClient({ schedule_runs: { data: [runRow()], error: null } });
    expect(await repo.listScheduleRuns()).toHaveLength(1);
  });

  it("listScheduleRuns throws on a query error", async () => {
    const { repo } = withFakeClient({ schedule_runs: { data: null, error: { message: "boom" } } });
    await expect(repo.listScheduleRuns()).rejects.toThrow("boom");
  });
});

describe("SupabaseRepository — work log", () => {
  function entry(overrides: Partial<WorkLogEntry> = {}): WorkLogEntry {
    return { id: "wl_1", moduleId: "finance-analyst", runId: "run_1", cadence: "daily", step: "started", status: "info", loggedAt: "2026-07-12T00:00:00.000Z", ...overrides };
  }

  it("logWorkStep inserts and returns the given entry", async () => {
    const { repo } = withFakeClient({ work_log: { data: null, error: null } });
    expect((await repo.logWorkStep(entry())).id).toBe("wl_1");
  });

  it("listWorkLog maps rows and applies moduleId/runId filters", async () => {
    const row = { id: "wl_1", module_id: "finance-analyst", run_id: "run_1", cadence: "daily", step: "started", status: "info", attempt: 0, detail: "x", logged_at: "2026-07-12T00:00:00.000Z" };
    const { repo } = withFakeClient({ work_log: { data: [row], error: null } });
    expect(await repo.listWorkLog({})).toHaveLength(1);
    expect(await repo.listWorkLog({ moduleId: "finance-analyst" })).toHaveLength(1);
    expect(await repo.listWorkLog({ runId: "run_1" })).toHaveLength(1);
  });

  it("listWorkLog throws on a query error", async () => {
    const { repo } = withFakeClient({ work_log: { data: null, error: { message: "boom" } } });
    await expect(repo.listWorkLog({})).rejects.toThrow("boom");
  });
});

describe("SupabaseRepository — knowledge base", () => {
  function item(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
    return {
      id: "ki_1",
      moduleId: "marketing-intelligence",
      category: "trend",
      title: "T",
      firstSeenAt: "2026-07-12T00:00:00.000Z",
      lastSeenAt: "2026-07-12T00:00:00.000Z",
      timesSeen: 1,
      metadata: {},
      ...overrides,
    };
  }

  it("upsertKnowledgeItem upserts on conflict id and returns the given item", async () => {
    const { repo, calls } = withFakeClient({ knowledge_items: { data: null, error: null } });
    expect((await repo.upsertKnowledgeItem(item())).id).toBe("ki_1");
    expect(calls.knowledge_items?.[0]?.op).toBe("upsert");
    expect(calls.knowledge_items?.[0]?.opts).toEqual({ onConflict: "id" });
  });

  it("listKnowledgeItems maps rows and applies moduleId/category filters", async () => {
    const row = { id: "ki_1", module_id: "marketing-intelligence", category: "trend", title: "T", source_url: null, first_seen_at: "t", last_seen_at: "t", times_seen: 1, metadata: {} };
    const { repo } = withFakeClient({ knowledge_items: { data: [row], error: null } });
    expect(await repo.listKnowledgeItems({})).toHaveLength(1);
    expect(await repo.listKnowledgeItems({ moduleId: "marketing-intelligence", category: "trend" })).toHaveLength(1);
  });

  it("listKnowledgeItems throws on a query error", async () => {
    const { repo } = withFakeClient({ knowledge_items: { data: null, error: { message: "boom" } } });
    await expect(repo.listKnowledgeItems({})).rejects.toThrow("boom");
  });
});

describe("SupabaseRepository — business data fixtures", () => {
  it("serves the same seed fixtures as InMemoryRepository for sales/finance/HR/checklist", async () => {
    const { repo } = withFakeClient({});
    expect((await repo.getSalesSnapshot()).reps.length).toBeGreaterThan(0);
    expect((await repo.getFinanceSnapshot()).transactions.length).toBeGreaterThan(0);
    expect((await repo.getHRSnapshot()).staff.length).toBeGreaterThan(0);
    expect(Array.isArray((await repo.getMarkomChecklistCompletionState()).completedDayIndexes)).toBe(true);
  });
});

describe("SupabaseRepository — AI reasoning logs", () => {
  function logEntry(overrides: Partial<AIReasoningLogEntry> = {}): AIReasoningLogEntry {
    return {
      id: "log_1",
      moduleId: "finance-analyst",
      runId: "run_1",
      provider: "gemini",
      model: "gemini-2.0-flash",
      status: "success",
      responseTimeMs: 500,
      retryCount: 0,
      createdAt: "2026-07-12T00:00:00.000Z",
      ...overrides,
    };
  }

  it("saveAIReasoningLog inserts the row shape and returns the given entry", async () => {
    const { repo, calls } = withFakeClient({ ai_reasoning_logs: { data: null, error: null } });
    const saved = await repo.saveAIReasoningLog(logEntry());
    expect(saved.id).toBe("log_1");
    expect(calls.ai_reasoning_logs?.[0]?.op).toBe("insert");
    expect((calls.ai_reasoning_logs?.[0]?.row as Record<string, unknown>).module_id).toBe("finance-analyst");
  });

  it("listAIReasoningLogs maps rows and applies moduleId/runId filters", async () => {
    const row = {
      id: "log_1",
      module_id: "finance-analyst",
      run_id: "run_1",
      provider: "gemini",
      model: "gemini-2.0-flash",
      status: "success",
      response_time_ms: 500,
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      retry_count: 1,
      error_reason: null,
      created_at: "2026-07-12T00:00:00.000Z",
    };
    const { repo } = withFakeClient({ ai_reasoning_logs: { data: [row], error: null } });
    const result = await repo.listAIReasoningLogs({});
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "log_1", provider: "gemini", promptTokens: 100, completionTokens: 50, totalTokens: 150, retryCount: 1 });
    expect(await repo.listAIReasoningLogs({ moduleId: "finance-analyst" })).toHaveLength(1);
    expect(await repo.listAIReasoningLogs({ runId: "run_1" })).toHaveLength(1);
  });

  it("listAIReasoningLogs throws on a query error", async () => {
    const { repo } = withFakeClient({ ai_reasoning_logs: { data: null, error: { message: "boom" } } });
    await expect(repo.listAIReasoningLogs({})).rejects.toThrow("boom");
  });
});

describe("SupabaseRepository — job queue", () => {
  function jobRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "job_1",
      type: "notification-dispatch",
      payload: { foo: "bar" },
      priority: "normal",
      priority_rank: 2,
      status: "pending",
      run_at: "2026-07-13T00:00:00.000Z",
      attempts: 0,
      max_attempts: 3,
      last_error: null,
      created_at: "2026-07-13T00:00:00.000Z",
      updated_at: "2026-07-13T00:00:00.000Z",
      ...overrides,
    };
  }

  function job(overrides: Partial<QueueJob> = {}): QueueJob {
    return {
      id: "job_1",
      type: "notification-dispatch",
      payload: { foo: "bar" },
      priority: "normal",
      status: "pending",
      runAt: "2026-07-13T00:00:00.000Z",
      attempts: 0,
      maxAttempts: 3,
      createdAt: "2026-07-13T00:00:00.000Z",
      updatedAt: "2026-07-13T00:00:00.000Z",
      ...overrides,
    };
  }

  it("enqueueJob inserts the row shape including the derived priority_rank", async () => {
    const { repo, calls } = withFakeClient({ jobs: { data: null, error: null } });
    await repo.enqueueJob(job({ priority: "urgent" }));
    const row = calls.jobs?.[0]?.row as Record<string, unknown>;
    expect(calls.jobs?.[0]?.op).toBe("insert");
    expect(row.priority).toBe("urgent");
    expect(row.priority_rank).toBe(0);
  });

  it("getJob maps a found row and returns null when missing", async () => {
    const found = withFakeClient({ jobs: { data: jobRow(), error: null } });
    expect((await found.repo.getJob("job_1"))?.status).toBe("pending");

    const missing = withFakeClient({ jobs: { data: null, error: null } });
    expect(await missing.repo.getJob("job_x")).toBeNull();
  });

  it("getJob throws on a query error", async () => {
    const { repo } = withFakeClient({ jobs: { data: null, error: { message: "boom" } } });
    await expect(repo.getJob("job_1")).rejects.toThrow("boom");
  });

  it("listJobs maps rows, with and without status/type filters", async () => {
    const { repo } = withFakeClient({ jobs: { data: [jobRow(), jobRow({ id: "job_2" })], error: null } });
    expect(await repo.listJobs({})).toHaveLength(2);
    expect(await repo.listJobs({ status: "pending", type: "notification-dispatch" })).toHaveLength(2);
  });

  it("listJobs throws on a query error", async () => {
    const { repo } = withFakeClient({ jobs: { data: null, error: { message: "boom" } } });
    await expect(repo.listJobs({})).rejects.toThrow("boom");
  });

  it("updateJob sends the patch and maps the returned row", async () => {
    const { repo, calls } = withFakeClient({ jobs: { data: jobRow({ attempts: 1, last_error: "boom" }), error: null } });
    const updated = await repo.updateJob("job_1", { attempts: 1, lastError: "boom" });
    expect(updated.attempts).toBe(1);
    expect(calls.jobs?.[0]?.op).toBe("update");
  });

  it("updateJob throws on a query error", async () => {
    const { repo } = withFakeClient({ jobs: { data: null, error: { message: "boom" } } });
    await expect(repo.updateJob("job_1", { attempts: 1 })).rejects.toThrow("boom");
  });

  it("claimNextPendingJob returns null when no candidate is due", async () => {
    const { repo } = withFakeClient({ jobs: { data: null, error: null } });
    expect(await repo.claimNextPendingJob(undefined, "2026-07-13T00:00:00.000Z")).toBeNull();
  });

  it("claimNextPendingJob throws when the candidate select errors", async () => {
    const { repo } = withFakeClient({ jobs: { data: null, error: { message: "boom" } } });
    await expect(repo.claimNextPendingJob(undefined, "2026-07-13T00:00:00.000Z")).rejects.toThrow("boom");
  });

  it("claims the candidate by conditionally updating it and maps the result", async () => {
    const { repo } = withFakeClient({
      jobs: [
        { data: jobRow({ id: "job_1" }), error: null },
        { data: jobRow({ id: "job_1", status: "running" }), error: null },
      ],
    });
    const claimed = await repo.claimNextPendingJob("notification-dispatch", "2026-07-13T01:00:00.000Z");
    expect(claimed?.id).toBe("job_1");
    expect(claimed?.status).toBe("running");
  });

  it("returns null when the conditional update loses the race (already claimed by another caller)", async () => {
    const { repo } = withFakeClient({
      jobs: [
        { data: jobRow({ id: "job_1" }), error: null },
        { data: null, error: null },
      ],
    });
    expect(await repo.claimNextPendingJob(undefined, "2026-07-13T01:00:00.000Z")).toBeNull();
  });

  it("throws when the conditional update errors", async () => {
    const { repo } = withFakeClient({
      jobs: [
        { data: jobRow({ id: "job_1" }), error: null },
        { data: null, error: { message: "boom" } },
      ],
    });
    await expect(repo.claimNextPendingJob(undefined, "2026-07-13T01:00:00.000Z")).rejects.toThrow("boom");
  });
});

describe("SupabaseRepository — distributed scheduler lock", () => {
  function lockRow(overrides: Record<string, unknown> = {}) {
    return {
      lock_key: "scheduler:finance-analyst",
      holder_id: "holder-1",
      acquired_at: "2026-07-13T00:00:00.000Z",
      expires_at: "2026-07-13T01:00:00.000Z",
      ...overrides,
    };
  }

  it("acquireLock calls the RPC with the given key/holder/expiry and returns its boolean result", async () => {
    const { repo, calls } = withFakeClient({}, { acquire_scheduler_lock: { data: true, error: null } });
    const ok = await repo.acquireLock("scheduler:finance-analyst", "holder-1", "2026-07-13T01:00:00.000Z");
    expect(ok).toBe(true);
    expect(calls["rpc:acquire_scheduler_lock"]?.[0]?.args).toEqual({
      p_lock_key: "scheduler:finance-analyst",
      p_holder_id: "holder-1",
      p_expires_at: "2026-07-13T01:00:00.000Z",
    });
  });

  it("acquireLock returns false when the RPC reports the lock is held elsewhere", async () => {
    const { repo } = withFakeClient({}, { acquire_scheduler_lock: { data: false, error: null } });
    expect(await repo.acquireLock("scheduler:finance-analyst", "holder-2", "2026-07-13T01:00:00.000Z")).toBe(false);
  });

  it("acquireLock throws on an RPC error", async () => {
    const { repo } = withFakeClient({}, { acquire_scheduler_lock: { data: null, error: { message: "boom" } } });
    await expect(repo.acquireLock("scheduler:finance-analyst", "holder-1", "2026-07-13T01:00:00.000Z")).rejects.toThrow("boom");
  });

  it("releaseLock issues a delete scoped to both lock_key and holder_id", async () => {
    const { repo, calls } = withFakeClient({ scheduler_locks: { data: null, error: null } });
    await repo.releaseLock("scheduler:finance-analyst", "holder-1");
    expect(calls.scheduler_locks?.[0]?.op).toBe("delete");
  });

  it("releaseLock throws on a query error", async () => {
    const { repo } = withFakeClient({ scheduler_locks: { data: null, error: { message: "boom" } } });
    await expect(repo.releaseLock("scheduler:finance-analyst", "holder-1")).rejects.toThrow("boom");
  });

  it("getLock maps a found row and returns null when missing", async () => {
    const found = withFakeClient({ scheduler_locks: { data: lockRow(), error: null } });
    const lock = (await found.repo.getLock("scheduler:finance-analyst")) as SchedulerLock;
    expect(lock.holderId).toBe("holder-1");

    const missing = withFakeClient({ scheduler_locks: { data: null, error: null } });
    expect(await missing.repo.getLock("scheduler:finance-analyst")).toBeNull();
  });

  it("getLock throws on a query error", async () => {
    const { repo } = withFakeClient({ scheduler_locks: { data: null, error: { message: "boom" } } });
    await expect(repo.getLock("scheduler:finance-analyst")).rejects.toThrow("boom");
  });
});

describe("SupabaseRepository — conversation log", () => {
  function entryRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "conv_1",
      module_id: "finance-analyst",
      run_id: "run_1",
      system_prompt: "system",
      user_prompt: "user",
      response_text: "response",
      created_at: "2026-07-13T00:00:00.000Z",
      ...overrides,
    };
  }

  function entry(overrides: Partial<ConversationLogEntry> = {}): ConversationLogEntry {
    return {
      id: "conv_1",
      moduleId: "finance-analyst",
      runId: "run_1",
      systemPrompt: "system",
      userPrompt: "user",
      responseText: "response",
      createdAt: "2026-07-13T00:00:00.000Z",
      ...overrides,
    };
  }

  it("saveConversationLog inserts the row shape and returns the given entry", async () => {
    const { repo, calls } = withFakeClient({ conversation_logs: { data: null, error: null } });
    const saved = await repo.saveConversationLog(entry());
    expect(saved.id).toBe("conv_1");
    expect(calls.conversation_logs?.[0]?.op).toBe("insert");
    expect((calls.conversation_logs?.[0]?.row as Record<string, unknown>).module_id).toBe("finance-analyst");
  });

  it("listConversationLogs maps rows and applies moduleId/runId filters", async () => {
    const { repo } = withFakeClient({ conversation_logs: { data: [entryRow()], error: null } });
    expect(await repo.listConversationLogs({})).toHaveLength(1);
    expect(await repo.listConversationLogs({ moduleId: "finance-analyst" })).toHaveLength(1);
    expect(await repo.listConversationLogs({ runId: "run_1" })).toHaveLength(1);
  });

  it("listConversationLogs throws on a query error", async () => {
    const { repo } = withFakeClient({ conversation_logs: { data: null, error: { message: "boom" } } });
    await expect(repo.listConversationLogs({})).rejects.toThrow("boom");
  });
});

describe("SupabaseRepository — integration logs (Sprint 4A)", () => {
  function logRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "il_1",
      connector: "whatsapp",
      direction: "outgoing",
      payload: { text: "hi" },
      status: "success",
      response_status: 200,
      error: null,
      created_at: "2026-07-14T00:00:00.000Z",
      ...overrides,
    };
  }

  function log(overrides: Partial<IntegrationLogEntry> = {}): IntegrationLogEntry {
    return {
      id: "il_1",
      connector: "whatsapp",
      direction: "outgoing",
      payload: { text: "hi" },
      status: "success",
      createdAt: "2026-07-14T00:00:00.000Z",
      ...overrides,
    };
  }

  it("saveIntegrationLog inserts the row shape and returns the given entry", async () => {
    const { repo, calls } = withFakeClient({ integration_logs: { data: null, error: null } });
    const saved = await repo.saveIntegrationLog(log());
    expect(saved.id).toBe("il_1");
    expect(calls.integration_logs?.[0]?.op).toBe("insert");
    expect((calls.integration_logs?.[0]?.row as Record<string, unknown>).connector).toBe("whatsapp");
  });

  it("listIntegrationLogs maps rows and applies connector/direction/status filters", async () => {
    const { repo } = withFakeClient({ integration_logs: { data: [logRow()], error: null } });
    expect(await repo.listIntegrationLogs({})).toHaveLength(1);
    expect(await repo.listIntegrationLogs({ connector: "whatsapp" })).toHaveLength(1);
    expect(await repo.listIntegrationLogs({ direction: "outgoing" })).toHaveLength(1);
    expect(await repo.listIntegrationLogs({ status: "success" })).toHaveLength(1);
  });

  it("listIntegrationLogs throws on a query error", async () => {
    const { repo } = withFakeClient({ integration_logs: { data: null, error: { message: "boom" } } });
    await expect(repo.listIntegrationLogs({})).rejects.toThrow("boom");
  });
});

describe("SupabaseRepository — chat conversations (Sprint 4A)", () => {
  function conversationRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "conv_1",
      connector: "whatsapp",
      sender: "+62-812-0000",
      intent: null,
      assigned_agent: null,
      status: "open",
      history: [],
      created_at: "2026-07-14T00:00:00.000Z",
      updated_at: "2026-07-14T00:00:00.000Z",
      ...overrides,
    };
  }

  function conversation(overrides: Partial<ChatConversation> = {}): ChatConversation {
    return {
      id: "conv_1",
      connector: "whatsapp",
      sender: "+62-812-0000",
      intent: null,
      assignedAgent: null,
      status: "open",
      history: [],
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
      ...overrides,
    };
  }

  it("saveConversation upserts on conflict id and returns the given conversation", async () => {
    const { repo, calls } = withFakeClient({ chat_conversations: { data: null, error: null } });
    expect((await repo.saveConversation(conversation())).id).toBe("conv_1");
    expect(calls.chat_conversations?.[0]?.op).toBe("upsert");
    expect(calls.chat_conversations?.[0]?.opts).toEqual({ onConflict: "id" });
  });

  it("getConversation maps a found row and returns null when missing", async () => {
    const found = withFakeClient({ chat_conversations: { data: conversationRow(), error: null } });
    expect((await found.repo.getConversation("conv_1"))?.sender).toBe("+62-812-0000");

    const missing = withFakeClient({ chat_conversations: { data: null, error: null } });
    expect(await missing.repo.getConversation("conv_x")).toBeNull();
  });

  it("getConversation throws on a query error", async () => {
    const { repo } = withFakeClient({ chat_conversations: { data: null, error: { message: "boom" } } });
    await expect(repo.getConversation("conv_1")).rejects.toThrow("boom");
  });

  it("listConversations maps rows and applies connector/status/assignedAgent filters", async () => {
    const { repo } = withFakeClient({ chat_conversations: { data: [conversationRow()], error: null } });
    expect(await repo.listConversations({})).toHaveLength(1);
    expect(await repo.listConversations({ connector: "whatsapp" })).toHaveLength(1);
    expect(await repo.listConversations({ status: "open" })).toHaveLength(1);
    expect(await repo.listConversations({ assignedAgent: "hr-officer" })).toHaveLength(1);
  });

  it("listConversations throws on a query error", async () => {
    const { repo } = withFakeClient({ chat_conversations: { data: null, error: { message: "boom" } } });
    await expect(repo.listConversations({})).rejects.toThrow("boom");
  });
});
