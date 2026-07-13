import { beforeEach, describe, expect, it } from "vitest";
import type {
  AIReasoningLogEntry,
  AIReport,
  ApprovalRequest,
  ChatConversation,
  ConversationLogEntry,
  IntegrationLogEntry,
  QueueJob,
  WorkLogEntry,
} from "@mkh/shared";
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

describe("InMemoryRepository — AI reasoning logs", () => {
  let repo: InMemoryRepository;
  beforeEach(() => (repo = new InMemoryRepository()));

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

  it("saves and lists reasoning log entries, most recent first", async () => {
    await repo.saveAIReasoningLog(logEntry({ id: "a" }));
    await repo.saveAIReasoningLog(logEntry({ id: "b" }));
    const logs = await repo.listAIReasoningLogs({});
    expect(logs.map((l) => l.id)).toEqual(["b", "a"]);
  });

  it("filters by moduleId and runId independently", async () => {
    await repo.saveAIReasoningLog(logEntry({ id: "a", moduleId: "finance-analyst", runId: "run_1" }));
    await repo.saveAIReasoningLog(logEntry({ id: "b", moduleId: "hr-officer", runId: "run_2" }));

    const byModule = await repo.listAIReasoningLogs({ moduleId: "hr-officer" });
    expect(byModule.map((l) => l.id)).toEqual(["b"]);

    const byRun = await repo.listAIReasoningLogs({ runId: "run_1" });
    expect(byRun.map((l) => l.id)).toEqual(["a"]);
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

describe("InMemoryRepository — job queue", () => {
  let repo: InMemoryRepository;
  beforeEach(() => (repo = new InMemoryRepository()));

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

  it("round-trips a saved job through getJob", async () => {
    await repo.enqueueJob(job());
    expect((await repo.getJob("job_1"))?.status).toBe("pending");
  });

  it("returns null for an unknown job id", async () => {
    expect(await repo.getJob("nope")).toBeNull();
  });

  it("listJobs filters by status and type independently", async () => {
    await repo.enqueueJob(job({ id: "a", status: "pending", type: "notification-dispatch" }));
    await repo.enqueueJob(job({ id: "b", status: "failed", type: "notification-dispatch" }));
    await repo.enqueueJob(job({ id: "c", status: "pending", type: "other" }));

    expect((await repo.listJobs({ status: "failed" })).map((j) => j.id)).toEqual(["b"]);
    expect((await repo.listJobs({ type: "other" })).map((j) => j.id)).toEqual(["c"]);
  });

  it("updateJob merges a partial patch and throws for an unknown id", async () => {
    await repo.enqueueJob(job({ id: "a", attempts: 0 }));
    const updated = await repo.updateJob("a", { attempts: 1, lastError: "boom" });
    expect(updated.attempts).toBe(1);
    expect(updated.lastError).toBe("boom");
    expect(updated.type).toBe("notification-dispatch"); // untouched fields preserved

    await expect(repo.updateJob("nope", { attempts: 1 })).rejects.toThrow("not found");
  });

  it("claimNextPendingJob returns null when nothing is due", async () => {
    await repo.enqueueJob(job({ id: "future", runAt: "2099-01-01T00:00:00.000Z" }));
    expect(await repo.claimNextPendingJob(undefined, "2026-07-13T00:00:00.000Z")).toBeNull();
  });

  it("claimNextPendingJob prefers higher priority, then earlier runAt, and marks the job running", async () => {
    await repo.enqueueJob(job({ id: "low", priority: "low", runAt: "2026-07-13T00:00:00.000Z" }));
    await repo.enqueueJob(job({ id: "urgent", priority: "urgent", runAt: "2026-07-13T00:01:00.000Z" }));

    const claimed = await repo.claimNextPendingJob(undefined, "2026-07-13T01:00:00.000Z");
    expect(claimed?.id).toBe("urgent");
    expect(claimed?.status).toBe("running");

    const stillPending = await repo.getJob("low");
    expect(stillPending?.status).toBe("pending");
  });

  it("claimNextPendingJob filters by type", async () => {
    await repo.enqueueJob(job({ id: "a", type: "notification-dispatch" }));
    await repo.enqueueJob(job({ id: "b", type: "other" }));
    const claimed = await repo.claimNextPendingJob("other", "2026-07-13T01:00:00.000Z");
    expect(claimed?.id).toBe("b");
  });
});

describe("InMemoryRepository — distributed scheduler lock", () => {
  let repo: InMemoryRepository;
  beforeEach(() => (repo = new InMemoryRepository()));

  it("acquires a free lock and reports it via getLock", async () => {
    const ok = await repo.acquireLock("scheduler:finance-analyst", "holder-1", "2026-07-13T01:00:00.000Z");
    expect(ok).toBe(true);
    expect((await repo.getLock("scheduler:finance-analyst"))?.holderId).toBe("holder-1");
  });

  it("refuses to acquire a lock genuinely held by a different, non-expired holder", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    await repo.acquireLock("scheduler:finance-analyst", "holder-1", future);
    const blocked = await repo.acquireLock("scheduler:finance-analyst", "holder-2", future);
    expect(blocked).toBe(false);
  });

  it("allows reclaiming an expired lock held by a different holder", async () => {
    const expired = new Date(Date.now() - 60_000).toISOString();
    await repo.acquireLock("scheduler:finance-analyst", "holder-1", expired);
    const reclaimed = await repo.acquireLock("scheduler:finance-analyst", "holder-2", "2026-07-13T01:00:00.000Z");
    expect(reclaimed).toBe(true);
    expect((await repo.getLock("scheduler:finance-analyst"))?.holderId).toBe("holder-2");
  });

  it("allows the same holder to renew its own lock even before expiry", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    await repo.acquireLock("scheduler:finance-analyst", "holder-1", future);
    const renewed = await repo.acquireLock("scheduler:finance-analyst", "holder-1", future);
    expect(renewed).toBe(true);
  });

  it("releaseLock is a no-op unless the caller is the current holder", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    await repo.acquireLock("scheduler:finance-analyst", "holder-1", future);

    await repo.releaseLock("scheduler:finance-analyst", "holder-2");
    expect((await repo.getLock("scheduler:finance-analyst"))?.holderId).toBe("holder-1");

    await repo.releaseLock("scheduler:finance-analyst", "holder-1");
    expect(await repo.getLock("scheduler:finance-analyst")).toBeNull();
  });

  it("getLock returns null for a lock key that was never acquired", async () => {
    expect(await repo.getLock("nope")).toBeNull();
  });
});

describe("InMemoryRepository — conversation log", () => {
  let repo: InMemoryRepository;
  beforeEach(() => (repo = new InMemoryRepository()));

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

  it("saves and lists conversation logs, most recent first", async () => {
    await repo.saveConversationLog(entry({ id: "a" }));
    await repo.saveConversationLog(entry({ id: "b" }));
    const logs = await repo.listConversationLogs({});
    expect(logs.map((l) => l.id)).toEqual(["b", "a"]);
  });

  it("filters by moduleId and runId independently", async () => {
    await repo.saveConversationLog(entry({ id: "a", moduleId: "finance-analyst", runId: "run_1" }));
    await repo.saveConversationLog(entry({ id: "b", moduleId: "hr-officer", runId: "run_2" }));

    expect((await repo.listConversationLogs({ moduleId: "hr-officer" })).map((l) => l.id)).toEqual(["b"]);
    expect((await repo.listConversationLogs({ runId: "run_1" })).map((l) => l.id)).toEqual(["a"]);
  });
});

describe("InMemoryRepository — integration logs (Sprint 4A)", () => {
  let repo: InMemoryRepository;
  beforeEach(() => (repo = new InMemoryRepository()));

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

  it("saves and lists integration logs, most recent first", async () => {
    await repo.saveIntegrationLog(log({ id: "a" }));
    await repo.saveIntegrationLog(log({ id: "b" }));
    const logs = await repo.listIntegrationLogs({});
    expect(logs.map((l) => l.id)).toEqual(["b", "a"]);
  });

  it("filters by connector, direction, and status independently", async () => {
    await repo.saveIntegrationLog(log({ id: "a", connector: "whatsapp", direction: "outgoing", status: "success" }));
    await repo.saveIntegrationLog(log({ id: "b", connector: "telegram", direction: "incoming", status: "error" }));

    expect((await repo.listIntegrationLogs({ connector: "telegram" })).map((l) => l.id)).toEqual(["b"]);
    expect((await repo.listIntegrationLogs({ direction: "outgoing" })).map((l) => l.id)).toEqual(["a"]);
    expect((await repo.listIntegrationLogs({ status: "error" })).map((l) => l.id)).toEqual(["b"]);
  });
});

describe("InMemoryRepository — chat conversations (Sprint 4A)", () => {
  let repo: InMemoryRepository;
  beforeEach(() => (repo = new InMemoryRepository()));

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

  it("saveConversation creates a new row and returns null from getConversation for an unknown id", async () => {
    expect(await repo.getConversation("conv_1")).toBeNull();
    await repo.saveConversation(conversation());
    expect((await repo.getConversation("conv_1"))?.sender).toBe("+62-812-0000");
  });

  it("saveConversation replaces the existing record in place rather than duplicating it", async () => {
    await repo.saveConversation(conversation({ status: "open" }));
    await repo.saveConversation(conversation({ status: "routed", assignedAgent: "sales-supervisor" }));

    const all = await repo.listConversations({});
    expect(all).toHaveLength(1);
    expect(all[0]?.status).toBe("routed");
    expect(all[0]?.assignedAgent).toBe("sales-supervisor");
  });

  it("filters listConversations by connector, status, and assignedAgent independently", async () => {
    await repo.saveConversation(conversation({ id: "a", connector: "whatsapp", status: "open", assignedAgent: null }));
    await repo.saveConversation(conversation({ id: "b", connector: "telegram", status: "routed", assignedAgent: "hr-officer" }));

    expect((await repo.listConversations({ connector: "telegram" })).map((c) => c.id)).toEqual(["b"]);
    expect((await repo.listConversations({ status: "open" })).map((c) => c.id)).toEqual(["a"]);
    expect((await repo.listConversations({ assignedAgent: "hr-officer" })).map((c) => c.id)).toEqual(["b"]);
  });
});
