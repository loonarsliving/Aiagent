import type { KnowledgeItem } from "@mkh/database";
import type { DiscoveredFact } from "./types";

/**
 * The "learning" rule: rediscovering an already-known fact strengthens it
 * (bumps `timesSeen`, refreshes `lastSeenAt`) instead of creating a
 * duplicate row. This is what turns "search again every day" into an
 * actual knowledge base — day 2's 50 items merge into day 1's 50 instead
 * of replacing them.
 */
export function mergeKnowledgeItem(existing: KnowledgeItem | null, incoming: DiscoveredFact, now: string): KnowledgeItem {
  if (!existing) {
    return {
      id: incoming.id,
      moduleId: incoming.moduleId,
      category: incoming.category,
      title: incoming.title,
      sourceUrl: incoming.sourceUrl,
      firstSeenAt: now,
      lastSeenAt: now,
      timesSeen: 1,
      metadata: incoming.metadata ?? {},
    };
  }

  return {
    ...existing,
    title: incoming.title,
    sourceUrl: incoming.sourceUrl ?? existing.sourceUrl,
    lastSeenAt: now,
    timesSeen: existing.timesSeen + 1,
    metadata: { ...existing.metadata, ...incoming.metadata },
  };
}
