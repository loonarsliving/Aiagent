import type { AIModuleId } from "@mkh/shared";
import type { KnowledgeItem } from "@mkh/database";

/**
 * A single fact an employee discovered during research, before it's been
 * merged into the knowledge base. `id` is the dedup key — callers own
 * constructing it (e.g. `${moduleId}:${category}:${externalId}`) so it's
 * stable across days for the same underlying real-world thing.
 */
export interface DiscoveredFact {
  id: string;
  moduleId: AIModuleId;
  category: string;
  title: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface RememberResult {
  item: KnowledgeItem;
  isNew: boolean;
}

export interface KnowledgeStats {
  totalItems: number;
  newToday: number;
  recurringToday: number;
  byCategory: Record<string, number>;
}
