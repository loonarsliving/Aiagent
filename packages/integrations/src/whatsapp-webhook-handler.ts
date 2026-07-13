import type { Repository } from "@mkh/database";
import type { ConnectorManager } from "./connector-manager";
import { WebhookEngine } from "./webhook-engine";
import { ConversationEngine } from "./conversation-engine";
import { AIRouter } from "./ai-router";
import { createDefaultAgentRegistry } from "./default-agents";
import { NotificationEngine } from "./notification-engine";
import { WhatsAppCloudConnector } from "./connectors/whatsapp-cloud-connector";

export interface WhatsAppWebhookHandlerResult {
  status: "processed" | "ignored" | "error";
  conversationId?: string;
  assignedAgent?: string | null;
  replySent?: boolean;
  reason?: string;
}

/**
 * Meta's webhook verification handshake (`GET` with `hub.mode` /
 * `hub.verify_token`). Only the real `WhatsAppCloudConnector` knows the
 * configured verify token — in mock mode (no WhatsApp credentials set)
 * there is nothing legitimate to verify against, so this always reports
 * false, which is the correct behavior: a webhook subscription should
 * never succeed against a connector that isn't actually live.
 */
export function verifyWhatsAppWebhookChallenge(mode: string | null, token: string | null, manager: ConnectorManager): boolean {
  const connector = manager.getConnector("whatsapp");
  return connector instanceof WhatsAppCloudConnector ? connector.verifyWebhook(mode, token) : false;
}

/**
 * The full "receive one WhatsApp event" pipeline (Sprint 4B brief, item
 * 5): validate + normalize + log (`WebhookEngine`, delegating the
 * channel-specific parsing to whichever connector — mock or live — is
 * currently active) -> save/continue the conversation and resolve a
 * destination agent (`ConversationEngine` + `AIRouter`) -> send the
 * routing result back to WhatsApp (`NotificationEngine`, through the same
 * `ConnectorManager`, so the reply goes out via the real Graph API when
 * the connector is live and is a no-op-but-logged mock send otherwise).
 *
 * The Next.js route handler is a thin wrapper around this function — see
 * `apps/dashboard/src/app/api/integrations/whatsapp/webhook/route.ts`.
 * Kept here, independent of Next.js, specifically so it can be
 * integration-tested with plain vitest (`whatsapp-webhook-handler.test.ts`)
 * without needing a Next.js test harness this monorepo doesn't otherwise use.
 */
export async function handleWhatsAppWebhookEvent(
  repo: Repository,
  manager: ConnectorManager,
  rawPayload: unknown,
): Promise<WhatsAppWebhookHandlerResult> {
  const webhookEngine = new WebhookEngine(repo, manager.getAllConnectors());

  const received = await webhookEngine.receive({ connector: "whatsapp", rawPayload });
  if (!received.accepted) {
    return { status: "ignored", reason: received.reason };
  }

  try {
    const conversationEngine = new ConversationEngine(repo, new AIRouter(createDefaultAgentRegistry()));
    const conversation = await conversationEngine.processNextWebhookJob(webhookEngine);
    if (!conversation) {
      return { status: "ignored", reason: "no queued webhook job to process" };
    }

    const replyText = conversation.assignedAgent
      ? `Pesan Anda telah diteruskan ke tim ${conversation.assignedAgent}. Kami akan segera merespons.`
      : "Terima kasih, pesan Anda sudah kami terima dan akan segera ditindaklanjuti.";

    const notificationEngine = new NotificationEngine(manager);
    const sendResult = await notificationEngine.send({
      connector: "whatsapp",
      recipient: conversation.sender,
      content: { kind: "text", text: replyText },
    });

    return {
      status: "processed",
      conversationId: conversation.id,
      assignedAgent: conversation.assignedAgent,
      replySent: sendResult.success,
    };
  } catch (err) {
    return { status: "error", reason: err instanceof Error ? err.message : String(err) };
  }
}
