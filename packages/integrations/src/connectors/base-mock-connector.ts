import { generateId } from "@mkh/shared";
import type { ConnectorType, OutboundMessageContent } from "@mkh/shared";
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

export interface MockConnectorOptions {
  /** Test-only hook: return true to make the next simulated outbound call fail ("channel unavailable"), without ever making a real network call. Absent in production use. */
  shouldFail?: () => boolean;
}

/**
 * Shared behavior for every Sprint 4A mock connector (Part 2 of the
 * brief): stores every outgoing request, every incoming (webhook) request,
 * and each one's synthetic response status/timestamp via
 * `Repository.saveIntegrationLog` — never a real HTTP call. Retry and
 * queueing are deliberately NOT implemented here; those are the Connector
 * Manager's job (packages/integrations/src/connector-manager.ts), which
 * wraps every dispatch in the existing Job Queue/Retry Engine
 * (@mkh/queue) — a mock connector only needs to know how to attempt (and
 * honestly report success/failure of) a single send.
 */
export abstract class BaseMockConnector implements Connector {
  constructor(
    readonly type: ConnectorType,
    private readonly repo: Repository,
    private readonly options: MockConnectorOptions = {},
  ) {}

  private async logOutgoing(payload: unknown, result: SendResult): Promise<void> {
    await this.repo.saveIntegrationLog({
      id: generateId("il"),
      connector: this.type,
      direction: "outgoing",
      payload,
      status: result.success ? "success" : "error",
      responseStatus: result.success ? 200 : 502,
      error: result.error,
      createdAt: new Date().toISOString(),
    });
  }

  private simulateSend(): SendResult {
    if (this.options.shouldFail?.()) {
      return { success: false, error: `${this.type} mock connector: simulated delivery failure` };
    }
    return { success: true, externalId: generateId(`mock-${this.type}`) };
  }

  async sendMessage(input: SendMessageInput): Promise<SendResult> {
    const result = this.simulateSend();
    await this.logOutgoing({ kind: "sendMessage", ...input }, result);
    return result;
  }

  async sendTemplate(input: { recipient: string; templateName: string; params: Record<string, string> }): Promise<SendResult> {
    const result = this.simulateSend();
    await this.logOutgoing({ kind: "sendTemplate", ...input }, result);
    return result;
  }

  async sendMedia(input: { recipient: string; url: string; caption?: string }): Promise<SendResult> {
    const result = this.simulateSend();
    await this.logOutgoing({ kind: "sendMedia", ...input }, result);
    return result;
  }

  async broadcast(input: { recipients: string[]; content: OutboundMessageContent }): Promise<SendResult[]> {
    const results: SendResult[] = [];
    for (const recipient of input.recipients) {
      results.push(await this.sendMessage({ recipient, content: input.content }));
    }
    return results;
  }

  async receiveWebhook(input: WebhookInput): Promise<WebhookResult> {
    const normalized = this.normalize(input.rawPayload);
    await this.repo.saveIntegrationLog({
      id: generateId("il"),
      connector: this.type,
      direction: "incoming",
      payload: input.rawPayload,
      status: normalized ? "success" : "error",
      responseStatus: normalized ? 200 : 400,
      error: normalized ? undefined : "unrecognized webhook payload shape",
      createdAt: new Date().toISOString(),
    });
    if (!normalized) return { accepted: false, reason: "unrecognized webhook payload shape" };
    return { accepted: true, normalized };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return { ok: true, detail: `${this.type} mock connector operational (no external API configured)` };
  }

  /** Best-effort normalization of `{ sender: string, text: string }`-shaped payloads. Real adapters override this with the channel's actual webhook schema. */
  protected normalize(rawPayload: unknown): NormalizedInboundMessage | null {
    if (!rawPayload || typeof rawPayload !== "object") return null;
    const obj = rawPayload as Record<string, unknown>;
    if (typeof obj.sender !== "string" || typeof obj.text !== "string") return null;
    return { sender: obj.sender, content: { kind: "text", text: obj.text }, receivedAt: new Date().toISOString() };
  }
}
