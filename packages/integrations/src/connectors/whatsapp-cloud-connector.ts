import { generateId } from "@mkh/shared";
import type { OutboundMessageContent } from "@mkh/shared";
import type { Repository } from "@mkh/database";
import type {
  Connector,
  HealthCheckResult,
  NormalizedInboundMessage,
  SendMessageInput,
  SendResult,
  WebhookInput,
  WebhookResult,
} from "../connector";
import type { WhatsAppHttpClient } from "./whatsapp-http-client";

export interface WhatsAppCloudConnectorConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  verifyToken: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/** Walks a Meta Cloud API webhook payload down to `entry[0].changes[0].value.messages[0]` — null for any shape that doesn't match (including status-callback payloads, which carry `statuses` instead of `messages`). */
function extractFirstMessage(rawPayload: unknown): Record<string, unknown> | null {
  const entry = asRecord(rawPayload)?.entry;
  if (!Array.isArray(entry) || entry.length === 0) return null;
  const changes = asRecord(entry[0])?.changes;
  if (!Array.isArray(changes) || changes.length === 0) return null;
  const value = asRecord(changes[0])?.value;
  const messages = asRecord(value)?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  return asRecord(messages[0]);
}

function extractErrorMessage(json: unknown): string {
  const error = asRecord(asRecord(json)?.error);
  return typeof error?.message === "string" ? error.message : "unknown error";
}

function extractMessageId(json: unknown): string | undefined {
  const messages = asRecord(json)?.messages;
  if (Array.isArray(messages)) {
    const id = asRecord(messages[0])?.id;
    if (typeof id === "string") return id;
  }
  return undefined;
}

/**
 * Real WhatsApp Cloud API connector (Sprint 4B) — replaces the mock for
 * `type: "whatsapp"` once `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID`
 * / `WHATSAPP_BUSINESS_ACCOUNT_ID` / `WHATSAPP_VERIFY_TOKEN` are all set
 * (see `registry.ts` and `connector-config.ts`). Every call — success or
 * failure — is logged via `Repository.saveIntegrationLog`, including
 * round-trip latency, exactly like the mock connectors log every call,
 * so the Admin Dashboard's telemetry (last sync, latency, last error)
 * works identically whether the connector behind it is mock or live.
 */
export class WhatsAppCloudConnector implements Connector {
  readonly type = "whatsapp" as const;

  constructor(
    private readonly repo: Repository,
    private readonly config: WhatsAppCloudConnectorConfig,
    private readonly http: WhatsAppHttpClient,
  ) {}

  private async logOutgoing(payload: unknown, result: SendResult, responseStatus: number, latencyMs: number): Promise<void> {
    await this.repo.saveIntegrationLog({
      id: generateId("il"),
      connector: "whatsapp",
      direction: "outgoing",
      payload,
      status: result.success ? "success" : "error",
      responseStatus,
      error: result.error,
      latencyMs,
      createdAt: new Date().toISOString(),
    });
  }

  /** Validates credentials against the real Graph API by reading back the phone number's own metadata — the cheapest read that still proves the access token and phone number id are both valid. */
  async healthCheck(): Promise<HealthCheckResult> {
    const startedAt = Date.now();
    try {
      const response = await this.http.get(`/${this.config.phoneNumberId}?fields=verified_name,display_phone_number`);
      const latencyMs = Date.now() - startedAt;
      const ok = response.ok;
      await this.repo.saveIntegrationLog({
        id: generateId("il"),
        connector: "whatsapp",
        direction: "outgoing",
        payload: { kind: "healthCheck" },
        status: ok ? "success" : "error",
        responseStatus: response.status,
        error: ok ? undefined : extractErrorMessage(response.json),
        latencyMs,
        createdAt: new Date().toISOString(),
      });
      return {
        ok,
        detail: ok
          ? `WhatsApp Cloud API reachable (${latencyMs}ms)`
          : `WhatsApp Cloud API returned ${response.status}: ${extractErrorMessage(response.json)}`,
      };
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      const message = err instanceof Error ? err.message : String(err);
      await this.repo.saveIntegrationLog({
        id: generateId("il"),
        connector: "whatsapp",
        direction: "outgoing",
        payload: { kind: "healthCheck" },
        status: "error",
        error: message,
        latencyMs,
        createdAt: new Date().toISOString(),
      });
      return { ok: false, detail: `WhatsApp Cloud API unreachable: ${message}` };
    }
  }

  /** Stateless REST API — "connecting" just means proving the credentials work up front, so a caller finds out immediately rather than on the first real send. Throws if unhealthy. */
  async connect(): Promise<void> {
    const health = await this.healthCheck();
    if (!health.ok) throw new Error(health.detail);
  }

  /** Nothing to tear down for a stateless REST API — exists to satisfy the Connector lifecycle contract. */
  async disconnect(): Promise<void> {
    return;
  }

  async sendMessage(input: SendMessageInput): Promise<SendResult> {
    return this.dispatch(input.recipient, this.normalizeOutgoingMessage(input.content));
  }

  async sendTemplate(input: { recipient: string; templateName: string; params: Record<string, string> }): Promise<SendResult> {
    return this.dispatch(
      input.recipient,
      this.normalizeOutgoingMessage({ kind: "template", templateName: input.templateName, params: input.params }),
    );
  }

  async sendMedia(input: { recipient: string; url: string; caption?: string }): Promise<SendResult> {
    return this.dispatch(input.recipient, this.normalizeOutgoingMessage({ kind: "image", url: input.url, caption: input.caption }));
  }

  async broadcast(input: { recipients: string[]; content: OutboundMessageContent }): Promise<SendResult[]> {
    const results: SendResult[] = [];
    for (const recipient of input.recipients) {
      results.push(await this.sendMessage({ recipient, content: input.content }));
    }
    return results;
  }

  /** Maps an `OutboundMessageContent` into the Graph API `messages` request body (everything after `messaging_product`/`to`). Template params are mapped positionally to `{{1}}`, `{{2}}`, ... body parameters, since Meta's template API has no named-parameter concept. */
  normalizeOutgoingMessage(content: OutboundMessageContent): Record<string, unknown> {
    if (content.kind === "template") {
      const values = Object.values(content.params);
      return {
        type: "template",
        template: {
          name: content.templateName,
          language: { code: "en_US" },
          components: values.length ? [{ type: "body", parameters: values.map((value) => ({ type: "text", text: value })) }] : [],
        },
      };
    }
    if (content.kind === "image") {
      return { type: "image", image: { link: content.url, caption: content.caption } };
    }
    if (content.kind === "pdf") {
      return { type: "document", document: { link: content.url, filename: content.filename } };
    }
    if (content.kind === "buttons") {
      return {
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: content.text },
          action: { buttons: content.buttons.map((button) => ({ type: "reply", reply: { id: button.id, title: button.label } })) },
        },
      };
    }
    return { type: "text", text: { body: content.text } };
  }

  private async dispatch(recipient: string, messageBody: Record<string, unknown>): Promise<SendResult> {
    const body = { messaging_product: "whatsapp", to: recipient, ...messageBody };
    const startedAt = Date.now();
    try {
      const response = await this.http.post(`/${this.config.phoneNumberId}/messages`, body);
      const latencyMs = Date.now() - startedAt;
      const result: SendResult = response.ok
        ? { success: true, externalId: extractMessageId(response.json) }
        : { success: false, error: `Graph API returned ${response.status}: ${extractErrorMessage(response.json)}` };
      await this.logOutgoing(body, result, response.status, latencyMs);
      return result;
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      const result: SendResult = { success: false, error: err instanceof Error ? err.message : String(err) };
      await this.logOutgoing(body, result, 0, latencyMs);
      return result;
    }
  }

  /** Meta's webhook verification handshake — `GET ?hub.mode=subscribe&hub.verify_token=...`. Returns whether the request is legitimate; the caller (the Next.js route) is responsible for echoing `hub.challenge` back on success. */
  verifyWebhook(mode: string | null, token: string | null): boolean {
    return mode === "subscribe" && token === this.config.verifyToken;
  }

  async receiveWebhook(input: WebhookInput): Promise<WebhookResult> {
    const normalized = this.normalizeIncomingMessage(input.rawPayload);
    await this.repo.saveIntegrationLog({
      id: generateId("il"),
      connector: "whatsapp",
      direction: "incoming",
      payload: input.rawPayload,
      status: normalized ? "success" : "error",
      responseStatus: normalized ? 200 : 400,
      error: normalized ? undefined : "unrecognized WhatsApp webhook payload shape (or a non-message event, e.g. a status callback)",
      createdAt: new Date().toISOString(),
    });
    if (!normalized) {
      return { accepted: false, reason: "unrecognized WhatsApp webhook payload shape (or a non-message event, e.g. a status callback)" };
    }
    return { accepted: true, normalized };
  }

  /** Extracts the first inbound message from a Meta Cloud API webhook payload. Only `text` messages are parsed into structured content today — every other message type (image, location, interactive reply, ...) is preserved as `raw` JSON rather than dropped. */
  normalizeIncomingMessage(rawPayload: unknown): NormalizedInboundMessage | null {
    const message = extractFirstMessage(rawPayload);
    if (!message) return null;
    const sender = message.from;
    if (typeof sender !== "string") return null;

    if (message.type === "text") {
      const text = asRecord(message.text)?.body;
      if (typeof text === "string") {
        return { sender, content: { kind: "text", text }, receivedAt: new Date().toISOString() };
      }
    }
    return { sender, content: { kind: "raw", text: JSON.stringify(message) }, receivedAt: new Date().toISOString() };
  }
}
