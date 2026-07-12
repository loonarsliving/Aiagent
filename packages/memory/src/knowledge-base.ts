import type { AIModuleId } from "@mkh/shared";
import type { KnowledgeItem, Repository } from "@mkh/database";
import { mergeKnowledgeItem } from "./merge";
import type { DiscoveredFact, KnowledgeStats, RememberResult } from "./types";

/**
 * The "brain" layered over @mkh/database's dumb `upsertKnowledgeItem`
 * storage — same pattern as @mkh/security layering approval rules over
 * plain persistence. Construct one per employee run
 * (`new KnowledgeBase(getRepository())`).
 */
export class KnowledgeBase {
  constructor(private readonly repo: Repository) {}

  /** Merge a batch of freshly discovered facts (all from the same employee) into the knowledge base. */
  async remember(facts: DiscoveredFact[]): Promise<RememberResult[]> {
    if (facts.length === 0) return [];
    const moduleId = facts[0]!.moduleId;
    const existing = await this.repo.listKnowledgeItems({ moduleId }, 10_000);
    const existingById = new Map(existing.map((item) => [item.id, item]));
    const now = new Date().toISOString();

    const results: RememberResult[] = [];
    for (const fact of facts) {
      const prior = existingById.get(fact.id) ?? null;
      const merged = mergeKnowledgeItem(prior, fact, now);
      await this.repo.upsertKnowledgeItem(merged);
      results.push({ item: merged, isNew: prior === null });
    }
    return results;
  }

  async recall(moduleId: AIModuleId, category?: string, limit = 200): Promise<KnowledgeItem[]> {
    return this.repo.listKnowledgeItems({ moduleId, category }, limit);
  }

  async stats(moduleId: AIModuleId): Promise<KnowledgeStats> {
    const items = await this.repo.listKnowledgeItems({ moduleId }, 10_000);
    const today = new Date().toDateString();
    const isToday = (iso: string) => new Date(iso).toDateString() === today;

    const byCategory: Record<string, number> = {};
    let newToday = 0;
    let recurringToday = 0;
    for (const item of items) {
      byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
      if (isToday(item.firstSeenAt)) newToday += 1;
      else if (isToday(item.lastSeenAt)) recurringToday += 1;
    }

    return { totalItems: items.length, newToday, recurringToday, byCategory };
  }
}
