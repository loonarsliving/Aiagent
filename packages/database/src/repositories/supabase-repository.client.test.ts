import { describe, expect, it } from "vitest";
import type { AIReport, ApprovalRequest, NotificationMessage, ScheduleEntry, ScheduleRunRecord, WorkLogEntry } from "@mkh/shared";
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

function createFakeClient(resultByTable: Record<string, FakeResult>) {
  const calls: Record<string, { op: string; row?: unknown; opts?: unknown }[]> = {};

  function record(table: string, op: string, row?: unknown, opts?: unknown) {
    (calls[table] ??= []).push({ op, row, opts });
  }

  function builder(table: string) {
    const result = resultByTable[table] ?? { data: null, error: null };
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
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
      maybeSingle: () => Promise.resolve(result),
      single: () => Promise.resolve(result),
      then: (resolve: (v: FakeResult) => void, reject: (e: unknown) => void) => Promise.resolve(result).then(resolve, reject),
    };
    return chain;
  }

  return { client: { from: builder }, calls };
}

function withFakeClient(resultByTable: Record<string, FakeResult>) {
  const repo = new SupabaseRepository("https://example.supabase.co", "test-service-key");
  const { client, calls } = createFakeClient(resultByTable);
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
