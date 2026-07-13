import type { AIModuleId } from "@mkh/shared";
import type { AgentRegistry } from "./agent-registry";

/**
 * AI Router (Sprint 4A brief, Part 9): given a conversation's text,
 * determine the destination agent. Deterministic keyword matching today
 * (via `AgentRegistry.resolveBestMatch`) — no external AI call, per this
 * sprint's "no external API" rule. Swapping this for an LLM-based
 * classifier later (through the existing Reasoning Engine) means
 * replacing `route()`'s implementation only; every caller (the
 * Conversation Engine) keeps calling `route(text)` unchanged.
 */
export class AIRouter {
  constructor(private readonly registry: AgentRegistry) {}

  route(text: string): AIModuleId | null {
    return this.registry.resolveBestMatch(text)?.moduleId ?? null;
  }
}
