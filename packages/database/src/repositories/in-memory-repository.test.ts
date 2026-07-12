import { beforeEach, describe, expect, it } from "vitest";
import type { AIReport, ApprovalRequest, WorkLogEntry } from "@mkh/shared";
import type { KnowledgeItem } from "../domain-types";
import { InMemoryRepository } from "./in-memory-repository";

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

function approval(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id: "apr_1",
    moduleId: "meta-ads-specialist",
    actionType: "decrease_budget",
    campaignId: "cmp_1",
    campaignName: "Campaign",
    reason: "x",
    proposedChange: {},
    status: "pending",
    requestedAt: "2026-07-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("InMemoryRepository — reports", () => {
  let repo: InMemoryRepository;
  beforeEach(() => (repo = new InMemoryRepository()));

  it("returns null from getLatestReport when nothing has been saved for that module", async () => {
    expect(await repo.getLatestReport("finance-analyst")).toBeNull();
  });

  it("returns the most recently saved report for a module", async () => {
    await repo.saveReport(report({ id: "rpt_1", summary: "first" }));
    await repo.saveReport(report({ id: "rpt_2", summary: "second" }));
    const latest = await repo.getLatestReport("finance-analyst");
    expect(latest?.id).toBe("rpt_2");
  });

  it("listReports filters by moduleId and respects limit", async () => {
    await repo.saveReport(report({ id: "a", moduleId: "finance-analyst" }));
    await repo.saveReport(report({ id: "b", moduleId: "sales-supervisor" }));
    await repo.saveReport(report({ id: "c", moduleId: "finance-analyst" }));

    const financeOnly = await repo.listReports("finance-analyst");
    expect(financeOnly.map((r) => r.id)).toEqual(["c", "a"]);

    const limited = await repo.listReports(undefined, 2);
    expect(limited).toHaveLength(2);
  });

  it("listRecentReports filters by moduleId+cadence and returns oldest-first", async () => {
    await repo.saveReport(report({ id: "d1", cadence: "daily" }));
    await repo.saveReport(report({ id: "w1", cadence: "weekly" }));
    await repo.saveReport(report({ id: "d2", cadence: "daily" }));

    const daily = await repo.listRecentReports("finance-analyst", "daily", 10);
    expect(daily.map((r) => r.id)).toEqual(["d1", "d2"]); // oldest first
  });
});

describe("InMemoryRepository — approvals", () => {
  let repo: InMemoryRepository;
  beforeEach(() => (repo = new InMemoryRepository()));

  it("round-trips a saved approval through getApproval", async () => {
    await repo.saveApproval(approval());
    expect((await repo.getApproval("apr_1"))?.status).toBe("pending");
  });

  it("returns null for an unknown approval id", async () => {
    expect(await repo.getApproval("does-not-exist")).toBeNull();
  });

  it("filters listApprovals by status", async () => {
    await repo.saveApproval(approval({ id: "a1", status: "pending" }));
    await repo.saveApproval(approval({ id: "a2", status: "approved" }));
    expect((await repo.listApprovals("approved")).map((a) => a.id)).toEqual(["a2"]);
  });

  it("updateApproval replaces the existing record in place rather than duplicating it", async () => {
    await repo.saveApproval(approval({ id: "a1", status: "pending" }));
    await repo.updateApproval(approval({ id: "a1", status: "approved" }));
    const all = await repo.listApprovals();
    expect(all).toHaveLength(1);
    expect(all[0]?.status).toBe("approved");
  });
});

describe("InMemoryRepository — schedule runs", () => {
  let repo: InMemoryRepository;
  beforeEach(() => (repo = new InMemoryRepository()));

  it("throws when updating a schedule run that was never saved", async () => {
    await expect(repo.updateScheduleRun("nope", { status: "success" })).rejects.toThrow("not found");
  });

  it("merges a partial patch into the existing schedule run", async () => {
    await repo.saveScheduleRun({
      id: "run_1",
      moduleId: "finance-analyst",
      cadence: "daily",
      scheduledTime: "15:00",
      startedAt: "2026-07-12T00:00:00.000Z",
      status: "running",
    });
    const updated = await repo.updateScheduleRun("run_1", { status: "success", reportId: "rpt_1" });
    expect(updated.status).toBe("success");
    expect(updated.reportId).toBe("rpt_1");
    expect(updated.scheduledTime).toBe("15:00"); // untouched fields preserved
  });

  it("seeds a non-empty default schedule with every cadence represented", async () => {
    const entries = await repo.listScheduleEntries();
    expect(entries.length).toBeGreaterThan(0);
    expect(new Set(entries.map((e) => e.cadence))).toEqual(new Set(["daily", "weekly", "monthly"]));
  });
});

describe("InMemoryRepository — work log", () => {
  let repo: InMemoryRepository;
  beforeEach(() => (repo = new InMemoryRepository()));

  function step(overrides: Partial<WorkLogEntry> = {}): WorkLogEntry {
    return {
      id: "wl_1",
      moduleId: "finance-analyst",
      runId: "run_1",
      cadence: "daily",
      step: "started",
      status: "info",
      loggedAt: "2026-07-12T00:00:00.000Z",
      ...overrides,
    };
  }

  it("filters by runId so one run's trail doesn't leak into another's", async () => {
    await repo.logWorkStep(step({ id: "1", runId: "run_a" }));
    await repo.logWorkStep(step({ id: "2", runId: "run_b" }));
    const runAOnly = await repo.listWorkLog({ runId: "run_a" });
    expect(runAOnly.map((e) => e.id)).toEqual(["1"]);
  });

  it("filters by moduleId", async () => {
    await repo.logWorkStep(step({ id: "1", moduleId: "finance-analyst" }));
    await repo.logWorkStep(step({ id: "2", moduleId: "sales-supervisor" }));
    const financeOnly = await repo.listWorkLog({ moduleId: "finance-analyst" });
    expect(financeOnly.map((e) => e.id)).toEqual(["1"]);
  });
});

describe("InMemoryRepository — knowledge base", () => {
  let repo: InMemoryRepository;
  beforeEach(() => (repo = new InMemoryRepository()));

  function item(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
    return {
      id: "k1",
      moduleId: "marketing-intelligence",
      category: "viral-content-instagram",
      title: "Title",
      firstSeenAt: "2026-07-12T00:00:00.000Z",
      lastSeenAt: "2026-07-12T00:00:00.000Z",
      timesSeen: 1,
      metadata: {},
      ...overrides,
    };
  }

  it("upsert by id replaces rather than duplicates", async () => {
    await repo.upsertKnowledgeItem(item({ timesSeen: 1 }));
    await repo.upsertKnowledgeItem(item({ timesSeen: 2 }));
    const items = await repo.listKnowledgeItems({});
    expect(items).toHaveLength(1);
    expect(items[0]?.timesSeen).toBe(2);
  });

  it("filters by moduleId and category independently", async () => {
    await repo.upsertKnowledgeItem(item({ id: "a", moduleId: "marketing-intelligence", category: "viral-content-instagram" }));
    await repo.upsertKnowledgeItem(item({ id: "b", moduleId: "marketing-intelligence", category: "competitor" }));
    await repo.upsertKnowledgeItem(item({ id: "c", moduleId: "sales-supervisor", category: "viral-content-instagram" }));

    const competitorOnly = await repo.listKnowledgeItems({ moduleId: "marketing-intelligence", category: "competitor" });
    expect(competitorOnly.map((i) => i.id)).toEqual(["b"]);

    const otherModule = await repo.listKnowledgeItems({ moduleId: "sales-supervisor" });
    expect(otherModule.map((i) => i.id)).toEqual(["c"]);
  });
});

describe("InMemoryRepository — business data fixtures", () => {
  let repo: InMemoryRepository;
  beforeEach(() => (repo = new InMemoryRepository()));

  it("getSalesSnapshot returns a non-empty seeded snapshot", async () => {
    const snapshot = await repo.getSalesSnapshot();
    expect(snapshot.reps.length).toBeGreaterThan(0);
  });

  it("getFinanceSnapshot returns a non-empty seeded snapshot", async () => {
    const snapshot = await repo.getFinanceSnapshot();
    expect(snapshot.transactions.length).toBeGreaterThan(0);
  });

  it("getMarkomChecklistCompletionState returns a seeded completion list", async () => {
    const state = await repo.getMarkomChecklistCompletionState();
    expect(Array.isArray(state.completedDayIndexes)).toBe(true);
  });

  it("getHRSnapshot returns a non-empty seeded snapshot", async () => {
    const snapshot = await repo.getHRSnapshot();
    expect(snapshot.staff.length).toBeGreaterThan(0);
  });

  it("each new InMemoryRepository instance is independently seeded (no shared mutable fixture state)", async () => {
    const repoA = new InMemoryRepository();
    const repoB = new InMemoryRepository();
    await repoA.saveReport(report());
    expect(await repoB.getLatestReport("finance-analyst")).toBeNull();
  });
});
