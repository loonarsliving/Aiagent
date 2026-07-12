import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryRepository, type KnowledgeItem } from "@mkh/database";
import { resetConfigCache } from "@mkh/shared";
import { AI_REASONING_HISTORY_CATEGORY, retrieveKnowledge, retrieveMemory, scoreKnowledgeItem } from "./retrieval";

function item(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
  return {
    id: "k1",
    moduleId: "finance-analyst",
    category: "anomaly-history",
    title: "Transaksi tidak biasa",
    firstSeenAt: "2026-07-12T00:00:00.000Z",
    lastSeenAt: "2026-07-12T00:00:00.000Z",
    timesSeen: 1,
    metadata: {},
    ...overrides,
  };
}

describe("scoreKnowledgeItem", () => {
  const now = new Date("2026-07-12T12:00:00.000Z");

  it("scores a fresh, frequently-seen item higher than a stale, rarely-seen one", () => {
    const fresh = scoreKnowledgeItem(item({ lastSeenAt: now.toISOString(), timesSeen: 8 }), undefined, now);
    const stale = scoreKnowledgeItem(item({ lastSeenAt: "2026-06-01T00:00:00.000Z", timesSeen: 1 }), undefined, now);
    expect(fresh).toBeGreaterThan(stale);
  });

  it("boosts items whose title overlaps with the query", () => {
    const matching = scoreKnowledgeItem(item({ title: "Anomali kategori Operasional" }), "anomali operasional", now);
    const nonMatching = scoreKnowledgeItem(item({ title: "Sesuatu yang lain sama sekali" }), "anomali operasional", now);
    expect(matching).toBeGreaterThan(nonMatching);
  });
});

describe("retrieveKnowledge", () => {
  let repo: InMemoryRepository;
  beforeEach(() => {
    repo = new InMemoryRepository();
    resetConfigCache();
  });

  it("never returns more than topK items even when the knowledge base has many more", async () => {
    for (let i = 0; i < 20; i++) {
      await repo.upsertKnowledgeItem(item({ id: `k${i}`, title: `Item ${i}` }));
    }
    const result = await retrieveKnowledge(repo, { moduleId: "finance-analyst", topK: 5 });
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("excludes ai-reasoning-history items — that's Memory, not Knowledge", async () => {
    await repo.upsertKnowledgeItem(item({ id: "k1", category: "anomaly-history" }));
    await repo.upsertKnowledgeItem(item({ id: "m1", category: AI_REASONING_HISTORY_CATEGORY, title: "Past recommendation" }));
    const result = await retrieveKnowledge(repo, { moduleId: "finance-analyst", topK: 10 });
    expect(result.map((r) => r.id)).toEqual(["k1"]);
  });

  it("only returns items scoped to the requested moduleId", async () => {
    await repo.upsertKnowledgeItem(item({ id: "a", moduleId: "finance-analyst" }));
    await repo.upsertKnowledgeItem(item({ id: "b", moduleId: "hr-officer" }));
    const result = await retrieveKnowledge(repo, { moduleId: "finance-analyst", topK: 10 });
    expect(result.map((r) => r.id)).toEqual(["a"]);
  });

  it("ranks the most relevant item first when a query is given", async () => {
    await repo.upsertKnowledgeItem(item({ id: "relevant", title: "Anomali kategori Operasional", timesSeen: 1, lastSeenAt: "2026-01-01T00:00:00.000Z" }));
    await repo.upsertKnowledgeItem(item({ id: "irrelevant", title: "Hal lain yang tidak nyambung", timesSeen: 1, lastSeenAt: "2026-01-01T00:00:00.000Z" }));
    const result = await retrieveKnowledge(repo, { moduleId: "finance-analyst", query: "anomali operasional", topK: 10 });
    expect(result[0]?.id).toBe("relevant");
  });
});

describe("retrieveMemory", () => {
  let repo: InMemoryRepository;
  beforeEach(() => {
    repo = new InMemoryRepository();
    resetConfigCache();
  });

  it("returns only this employee's own ai-reasoning-history items", async () => {
    await repo.upsertKnowledgeItem(item({ id: "m1", moduleId: "finance-analyst", category: AI_REASONING_HISTORY_CATEGORY, title: "Past decision" }));
    await repo.upsertKnowledgeItem(item({ id: "k1", moduleId: "finance-analyst", category: "anomaly-history" }));
    await repo.upsertKnowledgeItem(item({ id: "m2", moduleId: "hr-officer", category: AI_REASONING_HISTORY_CATEGORY }));

    const result = await retrieveMemory(repo, "finance-analyst");
    expect(result.map((r) => r.id)).toEqual(["m1"]);
  });

  it("respects an explicit limit", async () => {
    for (let i = 0; i < 5; i++) {
      await repo.upsertKnowledgeItem(item({ id: `m${i}`, category: AI_REASONING_HISTORY_CATEGORY }));
    }
    const result = await retrieveMemory(repo, "finance-analyst", 2);
    expect(result).toHaveLength(2);
  });
});
