import { describe, expect, it } from "vitest";
import type { KnowledgeItem } from "@mkh/database";
import { mergeKnowledgeItem } from "./merge";
import type { DiscoveredFact } from "./types";

function fact(overrides: Partial<DiscoveredFact> = {}): DiscoveredFact {
  return {
    id: "ig:viral-content:post_1",
    moduleId: "marketing-intelligence",
    category: "viral-content",
    title: "POV cicilan villa",
    ...overrides,
  };
}

describe("mergeKnowledgeItem", () => {
  it("creates a new item with timesSeen=1 when nothing existed before", () => {
    const item = mergeKnowledgeItem(null, fact(), "2026-07-12T08:00:00.000Z");
    expect(item.timesSeen).toBe(1);
    expect(item.firstSeenAt).toBe("2026-07-12T08:00:00.000Z");
    expect(item.lastSeenAt).toBe("2026-07-12T08:00:00.000Z");
  });

  it("bumps timesSeen and lastSeenAt on rediscovery instead of duplicating", () => {
    const day1 = mergeKnowledgeItem(null, fact(), "2026-07-12T08:00:00.000Z");
    const day2 = mergeKnowledgeItem(day1, fact({ title: "POV cicilan villa (updated)" }), "2026-07-13T08:00:00.000Z");

    expect(day2.timesSeen).toBe(2);
    expect(day2.firstSeenAt).toBe("2026-07-12T08:00:00.000Z"); // preserved
    expect(day2.lastSeenAt).toBe("2026-07-13T08:00:00.000Z"); // refreshed
    expect(day2.title).toBe("POV cicilan villa (updated)"); // refreshed
  });

  it("keeps growing across repeated rediscovery (day 1: 1 item, day 3: still 1 item, seen 3x)", () => {
    let item: KnowledgeItem | null = null;
    item = mergeKnowledgeItem(item, fact(), "2026-07-12T08:00:00.000Z");
    item = mergeKnowledgeItem(item, fact(), "2026-07-13T08:00:00.000Z");
    item = mergeKnowledgeItem(item, fact(), "2026-07-14T08:00:00.000Z");

    expect(item.timesSeen).toBe(3);
    expect(item.id).toBe(fact().id);
  });

  it("merges metadata rather than overwriting it wholesale", () => {
    const day1 = mergeKnowledgeItem(null, fact({ metadata: { engagementScore: 100 } }), "2026-07-12T08:00:00.000Z");
    const day2 = mergeKnowledgeItem(day1, fact({ metadata: { platform: "tiktok" } }), "2026-07-13T08:00:00.000Z");

    expect(day2.metadata).toEqual({ engagementScore: 100, platform: "tiktok" });
  });

  it("preserves the existing sourceUrl when the incoming fact doesn't provide one", () => {
    const day1 = mergeKnowledgeItem(null, fact({ sourceUrl: "https://instagram.com/p/1" }), "2026-07-12T08:00:00.000Z");
    const day2 = mergeKnowledgeItem(day1, fact({ sourceUrl: undefined }), "2026-07-13T08:00:00.000Z");

    expect(day2.sourceUrl).toBe("https://instagram.com/p/1");
  });
});
