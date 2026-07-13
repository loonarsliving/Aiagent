import type { AIModuleId } from "@mkh/shared";
import { getEmployee } from "@mkh/ai-engine";

export interface AgentRegistration {
  moduleId: AIModuleId;
  /** Lowercase keywords/phrases that should route an inbound message to this agent. */
  keywords: string[];
  description: string;
}

/**
 * Agent Registry (Sprint 4A brief, Part 10) — every agent registers
 * itself here with `register()` instead of being wired into a hardcoded
 * if/else or switch inside the AI Router. Adding an 11th agent, or
 * changing an existing one's keywords, never touches `ai-router.ts`.
 * `register()` resolves the moduleId against the real employee registry
 * (`@mkh/ai-engine`'s `getEmployee`) so a typo'd id fails loudly at
 * registration time rather than silently routing nowhere.
 */
export class AgentRegistry {
  private readonly agents = new Map<AIModuleId, AgentRegistration>();

  register(registration: AgentRegistration): void {
    getEmployee(registration.moduleId); // throws for an unknown employee id
    this.agents.set(registration.moduleId, registration);
  }

  list(): AgentRegistration[] {
    return Array.from(this.agents.values());
  }

  get(moduleId: AIModuleId): AgentRegistration | undefined {
    return this.agents.get(moduleId);
  }

  /** The agent with the most matching keywords against `text` (case-insensitive substring match); null if nothing matches at all. */
  resolveBestMatch(text: string): AgentRegistration | null {
    const lower = text.toLowerCase();
    let best: AgentRegistration | null = null;
    let bestScore = 0;
    for (const agent of this.agents.values()) {
      const score = agent.keywords.filter((keyword) => lower.includes(keyword)).length;
      if (score > bestScore) {
        best = agent;
        bestScore = score;
      }
    }
    return best;
  }
}
