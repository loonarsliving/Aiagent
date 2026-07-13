import type { ConnectorType, OutboundMessageContent } from "@mkh/shared";

export interface SendMessageInput {
  recipient: string;
  content: OutboundMessageContent;
}

export interface SendResult {
  success: boolean;
  /** A synthetic id standing in for whatever id a real API would return (a WhatsApp message id, a Telegram message id, ...). Never a real external identifier. */
  externalId?: string;
  error?: string;
}

export interface HealthCheckResult {
  ok: boolean;
  detail: string;
}

export interface WebhookInput {
  rawPayload: unknown;
  signature?: string;
}

/** What `Connector.receiveWebhook` normalizes a raw payload into — the shape the Webhook Engine and Conversation Engine consume, identical across every channel. */
export interface NormalizedInboundMessage {
  sender: string;
  content: OutboundMessageContent | { kind: "raw"; text: string };
  receivedAt: string;
}

export interface WebhookResult {
  accepted: boolean;
  reason?: string;
  normalized?: NormalizedInboundMessage;
}

/**
 * The one interface every external channel implements — WhatsApp,
 * Telegram, Email, Meta Marketing, MK Connect, OTA today, and any future
 * channel later. Nothing outside `packages/integrations/src/connectors/`
 * (the Connector Manager, the Notification Engine, the Webhook Engine)
 * knows or cares whether the concrete implementation behind this
 * interface is a mock or a real adapter — swapping one in for the other
 * is "add one adapter file, change one line in registry.ts," exactly like
 * `packages/connectors`' ports/adapters split from Sprint 1.
 */
export interface Connector {
  readonly type: ConnectorType;
  sendMessage(input: SendMessageInput): Promise<SendResult>;
  sendTemplate(input: { recipient: string; templateName: string; params: Record<string, string> }): Promise<SendResult>;
  sendMedia(input: { recipient: string; url: string; caption?: string }): Promise<SendResult>;
  broadcast(input: { recipients: string[]; content: OutboundMessageContent }): Promise<SendResult[]>;
  receiveWebhook(input: WebhookInput): Promise<WebhookResult>;
  healthCheck(): Promise<HealthCheckResult>;
  /**
   * Optional lifecycle hooks (Sprint 4B) — most connectors are plain REST
   * calls with nothing to "connect," so these are undefined for every mock
   * connector and for any future stateless adapter. A connector that does
   * have setup/teardown work (e.g. validating credentials up front) defines
   * them; `ConnectorManager.connect`/`disconnectConnector` no-op when absent.
   */
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
}
