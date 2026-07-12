import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "@mkh/database";
import { KnowledgeBase } from "./knowledge-base";
import type { DiscoveredFact } from "./types";

function fact(overrides: Partial<DiscoveredFact> = {}): DiscoveredFact {
  return {
    id: "marketing-intelligence:viral-content-instagram:post_1",
    moduleId: "marketing-intelligence",
    category: "viral-content-instagram",
    title: "POV cicilan villa",
    ...overrides,
  };
}

describe("KnowledgeBase.remember", () => {
  it("returns an empty array without touching the repository when given no facts", async () => {
    const kb = new KnowledgeBase(new InMemoryRepository());
    expect(await kb.remember([])).toEqual([]);
  });

  it("marks every fact as new on first discovery", async () => {
    const kb = new KnowledgeBase(new InMemoryRepository());
    const results = await kb.remember([fact({ id: "a" }), fact({ id: "b" })]);
    expect(results.every((r) => r.isNew)).toBe(true);
    expect(results.map((r) => r.item.timesSeen)).toEqual([1, 1]);
  });

  it("marks a fact as recurring (not new) and bumps timesSeen on rediscovery in a later call", async () => {
    const repo = new InMemoryRepository();
    const kb = new KnowledgeBase(repo);
    await kb.remember([fact({ id: "a" })]);
    const secondRun = await kb.remember([fact({ id: "a" })]);

    expect(secondRun[0]?.isNew).toBe(false);
    expect(secondRun[0]?.item.timesSeen).toBe(2);
  });

  it("persists remembered facts so they're recallable afterward", async () => {
    const repo = new InMemoryRepository();
    const kb = new KnowledgeBase(repo);
    await kb.remember([fact({ id: "a" }), fact({ id: "b", category: "competitor" })]);

    const recalled = await kb.recall("marketing-intelligence");
    expect(recalled.map((i) => i.id).sort()).toEqual(["a", "b"]);
  });
});

describe("KnowledgeBase.recall", () => {
  it("filters by category when provided", async () => {
    const repo = new InMemoryRepository();
    const kb = new KnowledgeBase(repo);
    await kb.remember([fact({ id: "a", category: "viral-content-instagram" }), fact({ id: "b", category: "competitor" })]);

    const competitorOnly = await kb.recall("marketing-intelligence", "competitor");
    expect(competitorOnly.map((i) => i.id)).toEqual(["b"]);
  });
});

describe("KnowledgeBase.stats", () => {
  it("counts total items and buckets them by category", async () => {
    const repo = new InMemoryRepository();
    const kb = new KnowledgeBase(repo);
    await kb.remember([
      fact({ id: "a", category: "viral-content-instagram" }),
      fact({ id: "b", category: "viral-content-instagram" }),
      fact({ id: "c", category: "competitor" }),
    ]);

    const stats = await kb.stats("marketing-intelligence");
    expect(stats.totalItems).toBe(3);
    expect(stats.byCategory["viral-content-instagram"]).toBe(2);
    expect(stats.byCategory["competitor"]).toBe(1);
  });

  it("counts everything discovered today as newToday on first run", async () => {
    const repo = new InMemoryRepository();
    const kb = new KnowledgeBase(repo);
    await kb.remember([fact({ id: "a" }), fact({ id: "b" })]);

    const stats = await kb.stats("marketing-intelligence");
    expect(stats.newToday).toBe(2);
    expect(stats.recurringToday).toBe(0);
  });

  it("returns zeroed stats for a module with nothing remembered yet", async () => {
    const kb = new KnowledgeBase(new InMemoryRepository());
    const stats = await kb.stats("marketing-intelligence");
    expect(stats).toEqual({ totalItems: 0, newToday: 0, recurringToday: 0, byCategory: {} });
  });
});
