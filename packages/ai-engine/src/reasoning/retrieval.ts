import { getConfig, type AIModuleId } from "@mkh/shared";
import type { KnowledgeItem, Repository } from "@mkh/database";

/**
 * Category the Reasoning Engine writes its own past outputs to — this IS
 * "Memory" in the Sprint 2 sense (an employee remembering its own past
 * recommendations), kept distinct from every other "Knowledge" category
 * (business facts the employee reads, not authored itself). Retrieval for
 * each is a separate function below because they answer different
 * questions ("what do I know" vs "what did I already say").
 */
export const AI_REASONING_HISTORY_CATEGORY = "ai-reasoning-history";

export interface KnowledgeRetrievalOptions {
  moduleId: AIModuleId;
  /** Free-text hint (e.g. today's observation) scored against item titles for relevance. */
  query?: string;
  /** Caps how many items are returned — this IS the "don't send the whole knowledge base" guarantee. Defaults to config.AI_RETRIEVAL_TOP_K. */
  topK?: number;
}

/** Recency (decays over ~10 days) + frequency (timesSeen, capped) + optional keyword overlap with `query`. Deterministic and cheap — no embeddings/vector DB, see docs/ARCHITECTURE.md for the trade-off. */
export function scoreKnowledgeItem(item: KnowledgeItem, query: string | undefined, now: Date): number {
  const ageDays = (now.getTime() - new Date(item.lastSeenAt).getTime()) / 86_400_000;
  let score = Math.max(0, 10 - ageDays) + Math.min(item.timesSeen, 10);

  if (query) {
    const queryLower = query.toLowerCase();
    const titleLower = item.title.toLowerCase();
    if (titleLower.includes(queryLower) || queryLower.includes(titleLower)) {
      score += 15;
    } else {
      const queryTokens = queryLower.split(/\s+/).filter(Boolean);
      const titleTokens = new Set(titleLower.split(/\s+/).filter(Boolean));
      score += queryTokens.filter((t) => titleTokens.has(t)).length * 5;
    }
  }

  return score;
}

/**
 * Top-K relevance-ranked retrieval from an employee's own knowledge base —
 * this IS the Retrieval Layer the brief requires ("jangan mengirim seluruh
 * Knowledge Base"). Excludes the ai-reasoning-history category, which is
 * "Memory" (see retrieveMemory) not "Knowledge".
 */
export async function retrieveKnowledge(repo: Repository, options: KnowledgeRetrievalOptions): Promise<KnowledgeItem[]> {
  const topK = options.topK ?? getConfig().AI_RETRIEVAL_TOP_K;
  const all = await repo.listKnowledgeItems({ moduleId: options.moduleId }, 2000);
  const knowledgeOnly = all.filter((item) => item.category !== AI_REASONING_HISTORY_CATEGORY);
  const now = new Date();

  return knowledgeOnly
    .map((item) => ({ item, score: scoreKnowledgeItem(item, options.query, now) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ item }) => item);
}

/**
 * An employee's own past reasoning outputs — continuity ("what did I
 * already recommend"), never another employee's memory (scoped by
 * moduleId, same isolation guarantee Sprint 1 established for the whole
 * knowledge base).
 */
export async function retrieveMemory(repo: Repository, moduleId: AIModuleId, limit?: number): Promise<KnowledgeItem[]> {
  const topK = limit ?? getConfig().AI_RETRIEVAL_TOP_K;
  return repo.listKnowledgeItems({ moduleId, category: AI_REASONING_HISTORY_CATEGORY }, topK);
}
