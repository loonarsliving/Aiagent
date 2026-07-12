import { describe, expect, it } from "vitest";
import type { ApprovalRequest } from "@mkh/shared";
import { mapApprovalRow, mapReportRow, mapScheduleRunRow, toApprovalRow, type Row } from "./supabase-repository";

/**
 * These are pure row<->domain-object mapping functions with no network
 * dependency — the exact place a column-name typo or missing null-coalesce
 * would hide, and the one part of SupabaseRepository testable without a
 * real Supabase project. Exported from supabase-repository.ts specifically
 * to make this possible (a visibility-only change, no behavior change).
 */

describe("mapReportRow", () => {
  it("maps snake_case columns to the camelCase AIReport shape", () => {
    const row: Row = {
      id: "rpt_1",
      module_id: "finance-analyst",
      cadence: "daily",
      generated_at: "2026-07-12T00:00:00.000Z",
      status: "success",
      summary: "ok",
      data: { foo: "bar" },
      error: null,
      duration_ms: 1234,
      retry_count: 0,
    };
    expect(mapReportRow(row)).toEqual({
      id: "rpt_1",
      moduleId: "finance-analyst",
      cadence: "daily",
      generatedAt: "2026-07-12T00:00:00.000Z",
      status: "success",
      summary: "ok",
      data: { foo: "bar" },
      error: undefined,
      durationMs: 1234,
      retryCount: 0,
    });
  });

  it("converts a SQL null error column to undefined, not the string \"null\"", () => {
    expect(mapReportRow({ id: "x", module_id: "m", cadence: "daily", generated_at: "t", status: "success", summary: "s", data: {}, error: null }).error).toBeUndefined();
  });

  it("passes through a real error message when present", () => {
    expect(mapReportRow({ id: "x", module_id: "m", cadence: "daily", generated_at: "t", status: "error", summary: "s", data: {}, error: "boom" }).error).toBe("boom");
  });

  it("converts null duration_ms/retry_count to undefined", () => {
    const mapped = mapReportRow({ id: "x", module_id: "m", cadence: "daily", generated_at: "t", status: "success", summary: "s", data: {}, error: null, duration_ms: null, retry_count: null });
    expect(mapped.durationMs).toBeUndefined();
    expect(mapped.retryCount).toBeUndefined();
  });
});

describe("mapScheduleRunRow", () => {
  it("maps a completed run including optional fields", () => {
    const row: Row = {
      id: "run_1",
      module_id: "sales-supervisor",
      cadence: "weekly",
      scheduled_time: "12:30",
      started_at: "2026-07-12T00:00:00.000Z",
      finished_at: "2026-07-12T00:05:00.000Z",
      status: "success",
      report_id: "rpt_1",
    };
    expect(mapScheduleRunRow(row)).toEqual({
      id: "run_1",
      moduleId: "sales-supervisor",
      cadence: "weekly",
      scheduledTime: "12:30",
      startedAt: "2026-07-12T00:00:00.000Z",
      finishedAt: "2026-07-12T00:05:00.000Z",
      status: "success",
      reportId: "rpt_1",
    });
  });

  it("maps a still-running run's null finished_at/report_id to undefined", () => {
    const mapped = mapScheduleRunRow({
      id: "run_2",
      module_id: "sales-supervisor",
      cadence: "daily",
      scheduled_time: "12:00",
      started_at: "2026-07-12T00:00:00.000Z",
      finished_at: null,
      status: "running",
      report_id: null,
    });
    expect(mapped.finishedAt).toBeUndefined();
    expect(mapped.reportId).toBeUndefined();
  });
});

describe("toApprovalRow / mapApprovalRow round-trip", () => {
  function approval(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
    return {
      id: "apr_1",
      moduleId: "meta-ads-specialist",
      actionType: "decrease_budget",
      campaignId: "cmp_1",
      campaignName: "Campaign A",
      reason: "CPL too high",
      proposedChange: { dailyBudgetIdr: 100_000 },
      status: "pending",
      requestedAt: "2026-07-12T00:00:00.000Z",
      ...overrides,
    };
  }

  it("round-trips a pending approval through to-row and back with no data loss", () => {
    const original = approval();
    const row = toApprovalRow(original);
    const back = mapApprovalRow(row);
    expect(back).toEqual(original);
  });

  it("round-trips a decided approval, preserving decidedAt/decidedBy", () => {
    const original = approval({ status: "approved", decidedAt: "2026-07-13T00:00:00.000Z", decidedBy: "Owner" });
    const back = mapApprovalRow(toApprovalRow(original));
    expect(back.decidedAt).toBe("2026-07-13T00:00:00.000Z");
    expect(back.decidedBy).toBe("Owner");
  });

  it("writes null (not undefined) for unset optional fields, since Postgres/PostgREST needs an explicit null to clear a column", () => {
    const row = toApprovalRow(approval());
    expect(row.decided_at).toBeNull();
    expect(row.decided_by).toBeNull();
  });
});
