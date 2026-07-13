import { createHmac, timingSafeEqual } from "node:crypto";
import type { Repository } from "@mkh/database";
import type { ConnectorType } from "@mkh/shared";
import { JobQueue } from "@mkh/queue";
import type { Connector, NormalizedInboundMessage } from "./connector";

/** The Job Queue job type every accepted webhook lands in, ready for the Conversation Engine (or anything else) to claim and process. */
export const WEBHOOK_INBOUND_JOB_TYPE = "webhook-inbound";

export interface WebhookInboundPayload {
  connector: ConnectorType;
  normalized: NormalizedInboundMessage;
}

export interface WebhookEngineInput {
  connector: ConnectorType;
  rawPayload: unknown;
  /** The signature header a real provider would send (e.g. `X-Hub-Signature-256`). Absent when no real webhook exists yet. */
  signature?: string;
  /** The shared secret to validate `signature` against. Absent -> signature validation is skipped entirely (there is nothing to validate against in mock mode). */
  secret?: string;
}

export interface WebhookEngineResult {
  accepted: boolean;
  reason?: string;
  jobId?: string;
}

/** HMAC-SHA256 over the JSON-serialized payload — the same shape most real webhook providers (Meta, WhatsApp Cloud, Stripe, ...) use for signature validation, so this becomes the real check unchanged once a real secret exists. */
export function computeWebhookSignature(secret: string, payload: unknown): string {
  return createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

function signaturesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Generic webhook receiver (Sprint 4A brief, Part 6): validate signature ->
 * parse/normalize via the connector's own `receiveWebhook` (each connector
 * knows its own payload shape) -> push the normalized message into the Job
 * Queue -> log everything. This class never interprets the payload itself
 * — that's the connector's job — and never decides what happens to an
 * accepted message — that's whatever claims `WEBHOOK_INBOUND_JOB_TYPE`
 * jobs next (the Conversation Engine today).
 */
export class WebhookEngine {
  private readonly queue: JobQueue;

  constructor(
    private readonly repo: Repository,
    private readonly connectors: Record<ConnectorType, Connector>,
  ) {
    this.queue = new JobQueue(repo);
  }

  async receive(input: WebhookEngineInput): Promise<WebhookEngineResult> {
    if (!this.validateSignature(input)) {
      return { accepted: false, reason: "invalid signature" };
    }

    // Every connector's receiveWebhook() already logs the incoming request
    // via Repository.saveIntegrationLog — the Webhook Engine doesn't log a
    // second time, it just reacts to the (already-logged) outcome.
    const connector = this.connectors[input.connector];
    const result = await connector.receiveWebhook({ rawPayload: input.rawPayload, signature: input.signature });
    if (!result.accepted || !result.normalized) {
      return { accepted: false, reason: result.reason ?? "connector rejected the payload" };
    }

    const job = await this.queue.enqueue<WebhookInboundPayload>(
      WEBHOOK_INBOUND_JOB_TYPE,
      { connector: input.connector, normalized: result.normalized },
      { priority: "high" },
    );
    return { accepted: true, jobId: job.id };
  }

  /**
   * Claims the next queued inbound webhook message, if any is due.
   * Consumers (e.g. the Conversation Engine) call this to drive their own
   * processing loop, then call `complete`/`fail` once they know whether
   * processing succeeded — the job stays retryable until they do.
   */
  async claimNext(): Promise<{ jobId: string; payload: WebhookInboundPayload } | null> {
    const job = await this.queue.claimNext(WEBHOOK_INBOUND_JOB_TYPE);
    if (!job) return null;
    return { jobId: job.id, payload: job.payload as WebhookInboundPayload };
  }

  async complete(jobId: string): Promise<void> {
    await this.queue.complete(jobId);
  }

  async fail(jobId: string, error: string): Promise<void> {
    await this.queue.fail(jobId, error);
  }

  private validateSignature(input: WebhookEngineInput): boolean {
    if (!input.secret) return true; // nothing configured to validate against — accept (mock mode)
    if (!input.signature) return false;
    return signaturesMatch(computeWebhookSignature(input.secret, input.rawPayload), input.signature);
  }
}
