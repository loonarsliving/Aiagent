import type { Repository } from "@mkh/database";
import { CONNECTOR_TYPES, type ConnectorStatus, type ConnectorType } from "@mkh/shared";
import { JobQueue } from "@mkh/queue";
import type { Connector, HealthCheckResult, SendMessageInput, SendResult } from "./connector";
import { createConnectorRegistry } from "./registry";
import { isConnectorConfigured, missingConnectorEnv } from "./connector-config";

/** The one Job Queue job type every connector dispatch retry flows through — see @mkh/queue's JobQueue for the generic retry/backoff/DLQ mechanics this reuses rather than reimplementing. */
export const CONNECTOR_DISPATCH_JOB_TYPE = "connector-dispatch";

export type DispatchAction = "sendMessage" | "sendTemplate" | "sendMedia";

export interface DispatchPayload {
  connector: ConnectorType;
  action: DispatchAction;
  input: unknown;
}

export interface ConnectorStatusReport {
  type: ConnectorType;
  status: ConnectorStatus;
  configured: boolean;
  missingEnv: string[];
  disabledByOperator: boolean;
  health: HealthCheckResult | null;
}

export interface ConnectorTelemetry {
  /** Most recent inbound request logged for this connector, accepted or not — Sprint 4B's "Last Webhook". */
  lastWebhookAt: string | null;
  /** Most recent inbound request that was successfully accepted/normalized — "Last Incoming Message". */
  lastIncomingMessageAt: string | null;
  /** Most recent outbound send that succeeded — "Last Outgoing Message". */
  lastOutgoingMessageAt: string | null;
  /** Round-trip time of the most recent logged call that recorded one (live connectors only). */
  lastLatencyMs: number | null;
  lastError: { message: string; at: string } | null;
}

/**
 * Central coordination point for every external channel (Sprint 4A brief,
 * Part 3). Responsibilities, each one method:
 * - `getConnector` — load the connector implementation for a type.
 * - `validateConfig` — is a real adapter's credentials present (env-var
 *   presence only; never validates them against a live API).
 * - `checkHealth`/`getStatus` — connector health + derived status.
 * - `route`/`retryNext` — dispatch a request, retrying failures through
 *   the existing Job Queue rather than a bespoke retry loop.
 * - `disable`/`enable`/`disableIfUnhealthy` — take an unavailable
 *   connector out of rotation without deleting/reconfiguring anything.
 */
export class ConnectorManager {
  private readonly connectors: Record<ConnectorType, Connector>;
  private readonly queue: JobQueue;
  private readonly disabled = new Set<ConnectorType>();

  constructor(
    private readonly repo: Repository,
    connectorsOverride?: Partial<Record<ConnectorType, Connector>>,
  ) {
    this.connectors = { ...createConnectorRegistry(repo), ...connectorsOverride };
    this.queue = new JobQueue(repo);
  }

  getConnector(type: ConnectorType): Connector {
    return this.connectors[type];
  }

  /** The full connector map — what the Webhook Engine needs to construct itself against every channel at once (see whatsapp-webhook-handler.ts). */
  getAllConnectors(): Record<ConnectorType, Connector> {
    return this.connectors;
  }

  /**
   * Runs the connector's own `connect()` lifecycle hook if it defines one
   * (mock connectors don't), then always reports the resulting health —
   * this method itself never throws, matching every other
   * ConnectorManager method's "errors are data, not exceptions" contract.
   */
  async connect(type: ConnectorType): Promise<HealthCheckResult> {
    const connector = this.connectors[type];
    if (connector.connect) {
      try {
        await connector.connect();
      } catch {
        // The health check below reflects the failure either way — nothing further to do here.
      }
    }
    return this.checkHealth(type);
  }

  async disconnectConnector(type: ConnectorType): Promise<void> {
    const connector = this.connectors[type];
    if (connector.disconnect) await connector.disconnect();
  }

  /**
   * What the Admin Dashboard's "Reconnect" button calls: clears any
   * operator-disabled state, attempts a fresh `connect()`, and
   * re-disables automatically if the connector turns out to still be
   * unhealthy — so a stale "disabled" state never has to be cleared by
   * hand once the underlying problem (bad credentials, an outage) is
   * actually fixed.
   */
  async reconnect(type: ConnectorType): Promise<ConnectorStatusReport> {
    this.enable(type);
    await this.connect(type);
    await this.disableIfUnhealthy(type);
    return this.getStatus(type);
  }

  /** Derives per-connector telemetry (last webhook/incoming/outgoing/latency/error) from the integration log — no separate storage, so it's automatically accurate for both mock and live connectors. */
  async getTelemetry(type: ConnectorType): Promise<ConnectorTelemetry> {
    const logs = await this.repo.listIntegrationLogs({ connector: type }, 200);
    const lastWebhook = logs.find((log) => log.direction === "incoming");
    const lastIncomingSuccess = logs.find((log) => log.direction === "incoming" && log.status === "success");
    const lastOutgoingSuccess = logs.find((log) => log.direction === "outgoing" && log.status === "success");
    const lastWithLatency = logs.find((log) => typeof log.latencyMs === "number");
    const lastErrorLog = logs.find((log) => log.status === "error");

    return {
      lastWebhookAt: lastWebhook?.createdAt ?? null,
      lastIncomingMessageAt: lastIncomingSuccess?.createdAt ?? null,
      lastOutgoingMessageAt: lastOutgoingSuccess?.createdAt ?? null,
      lastLatencyMs: lastWithLatency?.latencyMs ?? null,
      lastError: lastErrorLog ? { message: lastErrorLog.error ?? "unknown error", at: lastErrorLog.createdAt } : null,
    };
  }

  isEnabled(type: ConnectorType): boolean {
    return !this.disabled.has(type);
  }

  disable(type: ConnectorType): void {
    this.disabled.add(type);
  }

  enable(type: ConnectorType): void {
    this.disabled.delete(type);
  }

  /** Disables the connector if its own health check reports unhealthy. Returns whether it was disabled. */
  async disableIfUnhealthy(type: ConnectorType): Promise<boolean> {
    const health = await this.connectors[type].healthCheck();
    if (!health.ok) {
      this.disable(type);
      return true;
    }
    return false;
  }

  validateConfig(type: ConnectorType): { configured: boolean; missingEnv: string[] } {
    return { configured: isConnectorConfigured(type), missingEnv: missingConnectorEnv(type) };
  }

  async checkHealth(type: ConnectorType): Promise<HealthCheckResult> {
    return this.connectors[type].healthCheck();
  }

  async getStatus(type: ConnectorType): Promise<ConnectorStatusReport> {
    const { configured, missingEnv } = this.validateConfig(type);
    const disabledByOperator = this.disabled.has(type);
    const health = disabledByOperator ? null : await this.checkHealth(type);

    let status: ConnectorStatus;
    if (disabledByOperator) status = "disconnected";
    else if (health && !health.ok) status = "error";
    else if (configured) status = "connected"; // credentials present; still a mock implementation until a real adapter exists
    else status = "mock";

    return { type, status, configured, missingEnv, disabledByOperator, health };
  }

  async getAllStatuses(): Promise<ConnectorStatusReport[]> {
    return Promise.all(CONNECTOR_TYPES.map((type) => this.getStatus(type)));
  }

  private async dispatch(connector: Connector, action: DispatchAction, input: unknown): Promise<SendResult> {
    if (action === "sendMessage") return connector.sendMessage(input as SendMessageInput);
    if (action === "sendTemplate") return connector.sendTemplate(input as { recipient: string; templateName: string; params: Record<string, string> });
    return connector.sendMedia(input as { recipient: string; url: string; caption?: string });
  }

  /**
   * Routes a send-type request through the given connector immediately.
   * On failure, enqueues a retry job (the Job Queue owns backoff/DLQ) and
   * still returns the failed result so the caller gets immediate
   * feedback — retries continue in the background via `retryNext`.
   */
  async route(type: ConnectorType, action: DispatchAction, input: unknown): Promise<SendResult> {
    if (this.disabled.has(type)) {
      return { success: false, error: `${type} connector is disabled` };
    }
    const result = await this.dispatch(this.connectors[type], action, input);
    if (!result.success) {
      await this.queue.enqueue<DispatchPayload>(CONNECTOR_DISPATCH_JOB_TYPE, { connector: type, action, input }, { priority: "high" });
    }
    return result;
  }

  /** Claims and retries one pending connector-dispatch job, if any is due. Returns null when the queue is empty. */
  async retryNext(): Promise<{ jobId: string; result: SendResult } | null> {
    const job = await this.queue.claimNext(CONNECTOR_DISPATCH_JOB_TYPE);
    if (!job) return null;

    const payload = job.payload as DispatchPayload;
    if (this.disabled.has(payload.connector)) {
      await this.queue.fail(job.id, `${payload.connector} connector is disabled`);
      return { jobId: job.id, result: { success: false, error: `${payload.connector} connector is disabled` } };
    }

    const result = await this.dispatch(this.connectors[payload.connector], payload.action, payload.input);
    if (result.success) await this.queue.complete(job.id);
    else await this.queue.fail(job.id, result.error ?? "unknown error");
    return { jobId: job.id, result };
  }

  /**
   * Retries every currently-due pending job for one specific connector —
   * what the Admin Dashboard's per-connector "Retry" button calls.
   * `retryNext` (above) claims whatever job is globally next regardless of
   * connector, which is the right semantics for a background worker loop
   * but wrong for "retry this connector's backlog": this method instead
   * reads the connector's own pending jobs directly and dispatches each
   * one that's past its backoff `runAt`, still going through the same
   * `JobQueue.complete`/`fail` so retry/DLQ bookkeeping stays correct.
   */
  async retryAllPendingFor(type: ConnectorType, limit = 20): Promise<{ jobId: string; result: SendResult }[]> {
    const jobs = await this.repo.listJobs({ status: "pending", type: CONNECTOR_DISPATCH_JOB_TYPE }, Number.MAX_SAFE_INTEGER);
    const now = new Date().toISOString();
    const due = jobs.filter((job) => (job.payload as DispatchPayload).connector === type && job.runAt <= now).slice(0, limit);

    const results: { jobId: string; result: SendResult }[] = [];
    for (const job of due) {
      const payload = job.payload as DispatchPayload;
      const result = this.disabled.has(type)
        ? { success: false as const, error: `${type} connector is disabled` }
        : await this.dispatch(this.connectors[payload.connector], payload.action, payload.input);
      if (result.success) await this.queue.complete(job.id);
      else await this.queue.fail(job.id, result.error ?? "unknown error");
      results.push({ jobId: job.id, result });
    }
    return results;
  }

  async pendingRetryCount(type?: ConnectorType): Promise<number> {
    const jobs = await this.repo.listJobs({ status: "pending", type: CONNECTOR_DISPATCH_JOB_TYPE }, Number.MAX_SAFE_INTEGER);
    return type ? jobs.filter((j) => (j.payload as DispatchPayload).connector === type).length : jobs.length;
  }

  async failedCount(type?: ConnectorType): Promise<number> {
    const jobs = await this.repo.listJobs({ status: "dead", type: CONNECTOR_DISPATCH_JOB_TYPE }, Number.MAX_SAFE_INTEGER);
    return type ? jobs.filter((j) => (j.payload as DispatchPayload).connector === type).length : jobs.length;
  }
}
