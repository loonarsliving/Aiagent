import { generateId } from "@mkh/shared";
import type { ChatConversation, ChatMessage, ConnectorType } from "@mkh/shared";
import type { Repository } from "@mkh/database";
import type { NormalizedInboundMessage } from "./connector";
import type { AIRouter } from "./ai-router";
import type { WebhookEngine } from "./webhook-engine";

function textOf(content: NormalizedInboundMessage["content"]): string {
  return content.kind === "text" || content.kind === "raw" ? content.text : "";
}

/**
 * Conversation Engine (Sprint 4A brief, Part 8): every incoming message
 * becomes (or continues) exactly one `ChatConversation` — sender,
 * connector, message, intent, agent, status, history, timestamp, all
 * persisted via `Repository.saveConversation`. Routing to an agent goes
 * through the injected `AIRouter` (itself backed by the Agent Registry),
 * never a hardcoded lookup here.
 */
export class ConversationEngine {
  constructor(
    private readonly repo: Repository,
    private readonly router: AIRouter,
  ) {}

  /** Finds the sender's open (or already-routed, still-active) conversation on this connector, if one exists. */
  private async findActiveConversation(connector: ConnectorType, sender: string): Promise<ChatConversation | null> {
    const open = await this.repo.listConversations({ connector, status: "open" });
    const found = open.find((c) => c.sender === sender);
    if (found) return found;
    const routed = await this.repo.listConversations({ connector, status: "routed" });
    return routed.find((c) => c.sender === sender) ?? null;
  }

  /** Ingests one normalized inbound message: appends to (or opens) the sender's conversation, re-runs routing, and persists. Never sends anything — this is pure state, no connector call. */
  async ingestMessage(connector: ConnectorType, normalized: NormalizedInboundMessage): Promise<ChatConversation> {
    const message: ChatMessage = { id: generateId("msg"), direction: "incoming", content: normalized.content, createdAt: normalized.receivedAt };
    const text = textOf(normalized.content);
    const resolvedAgent = text ? this.router.route(text) : null;
    const now = new Date().toISOString();

    const existing = await this.findActiveConversation(connector, normalized.sender);
    const conversation: ChatConversation = existing
      ? {
          ...existing,
          intent: text || existing.intent,
          assignedAgent: resolvedAgent ?? existing.assignedAgent,
          status: resolvedAgent ? "routed" : existing.status,
          history: [...existing.history, message],
          updatedAt: now,
        }
      : {
          id: generateId("conv"),
          connector,
          sender: normalized.sender,
          intent: text || null,
          assignedAgent: resolvedAgent,
          status: resolvedAgent ? "routed" : "open",
          history: [message],
          createdAt: now,
          updatedAt: now,
        };

    await this.repo.saveConversation(conversation);
    return conversation;
  }

  /** Claims one queued webhook message from the given `WebhookEngine` and ingests it, completing or failing the underlying job accordingly. Returns null when there was nothing queued. */
  async processNextWebhookJob(webhookEngine: WebhookEngine): Promise<ChatConversation | null> {
    const claimed = await webhookEngine.claimNext();
    if (!claimed) return null;
    try {
      const conversation = await this.ingestMessage(claimed.payload.connector, claimed.payload.normalized);
      await webhookEngine.complete(claimed.jobId);
      return conversation;
    } catch (err) {
      await webhookEngine.fail(claimed.jobId, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  async close(conversationId: string): Promise<ChatConversation> {
    const conversation = await this.repo.getConversation(conversationId);
    if (!conversation) throw new Error(`Conversation ${conversationId} not found`);
    const updated: ChatConversation = { ...conversation, status: "closed", updatedAt: new Date().toISOString() };
    await this.repo.saveConversation(updated);
    return updated;
  }
}
