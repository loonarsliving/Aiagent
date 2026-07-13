import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "@mkh/database";
import type { Connector, HealthCheckResult, SendResult, WebhookResult } from "./connector";
import { ConnectorManager } from "./connector-manager";

function fakeConnector(overrides: Partial<Connector> = {}): Connector {
  return {
    type: "whatsapp",
    async sendMessage(): Promise<SendResult> {
      return { success: true, externalId: "fake-1" };
    },
    async sendTemplate(): Promise<SendResult> {
      return { success: true, externalId: "fake-2" };
    },
    async sendMedia(): Promise<SendResult> {
      return { success: true, externalId: "fake-3" };
    },
    async broadcast(): Promise<SendResult[]> {
      return [];
    },
    async receiveWebhook(): Promise<WebhookResult> {
      return { accepted: true };
    },
    async healthCheck(): Promise<HealthCheckResult> {
      return { ok: true, detail: "ok" };
    },
    ...overrides,
  };
}

describe("ConnectorManager — getConnector / getAllConnectors", () => {
  it("returns the underlying connector implementation for a type", () => {
    const manager = new ConnectorManager(new InMemoryRepository());
    expect(manager.getConnector("whatsapp").type).toBe("whatsapp");
  });

  it("getAllConnectors returns every connector keyed by type", () => {
    const manager = new ConnectorManager(new InMemoryRepository());
    const all = manager.getAllConnectors();
    expect(Object.keys(all).sort()).toEqual(["email", "meta", "mkconnect", "ota", "telegram", "whatsapp"]);
    expect(all.whatsapp).toBe(manager.getConnector("whatsapp"));
  });
});

describe("ConnectorManager — connect/disconnect/reconnect", () => {
  it("connect() runs the connector's connect() hook when present and returns its resulting health", async () => {
    let connected = false;
    const withConnect = fakeConnector({
      connect: async () => {
        connected = true;
      },
      healthCheck: async () => ({ ok: true, detail: "ready" }),
    });
    const manager = new ConnectorManager(new InMemoryRepository(), { whatsapp: withConnect });

    const health = await manager.connect("whatsapp");
    expect(connected).toBe(true);
    expect(health.ok).toBe(true);
  });

  it("connect() never throws even when the connector's connect() hook rejects — the health check still runs and reports the failure", async () => {
    const failingConnect = fakeConnector({
      connect: async () => {
        throw new Error("bad credentials");
      },
      healthCheck: async () => ({ ok: false, detail: "bad credentials" }),
    });
    const manager = new ConnectorManager(new InMemoryRepository(), { whatsapp: failingConnect });

    const health = await manager.connect("whatsapp");
    expect(health.ok).toBe(false);
  });

  it("connect() is a no-op for connectors that don't define connect() (e.g. every mock)", async () => {
    const manager = new ConnectorManager(new InMemoryRepository());
    await expect(manager.connect("email")).resolves.toMatchObject({ ok: true });
  });

  it("disconnectConnector() calls the connector's disconnect() hook when present, and no-ops otherwise", async () => {
    let disconnected = false;
    const withDisconnect = fakeConnector({
      disconnect: async () => {
        disconnected = true;
      },
    });
    const manager = new ConnectorManager(new InMemoryRepository(), { whatsapp: withDisconnect });
    await manager.disconnectConnector("whatsapp");
    expect(disconnected).toBe(true);

    await expect(manager.disconnectConnector("email")).resolves.toBeUndefined();
  });

  it("reconnect() re-enables a disabled connector and reports its refreshed status when healthy", async () => {
    const manager = new ConnectorManager(new InMemoryRepository());
    manager.disable("whatsapp");
    const status = await manager.reconnect("whatsapp");
    expect(manager.isEnabled("whatsapp")).toBe(true);
    expect(status.disabledByOperator).toBe(false);
  });

  it("reconnect() re-disables the connector automatically if it's still unhealthy", async () => {
    const stillUnhealthy = fakeConnector({ healthCheck: async () => ({ ok: false, detail: "still down" }) });
    const manager = new ConnectorManager(new InMemoryRepository(), { whatsapp: stillUnhealthy });
    manager.disable("whatsapp");

    const status = await manager.reconnect("whatsapp");
    expect(status.disabledByOperator).toBe(true);
    expect(status.status).toBe("disconnected");
  });
});

describe("ConnectorManager — getTelemetry", () => {
  it("returns all-null telemetry when nothing has been logged for the connector", async () => {
    const manager = new ConnectorManager(new InMemoryRepository());
    const telemetry = await manager.getTelemetry("whatsapp");
    expect(telemetry).toEqual({
      lastWebhookAt: null,
      lastIncomingMessageAt: null,
      lastOutgoingMessageAt: null,
      lastLatencyMs: null,
      lastError: null,
    });
  });

  it("derives lastWebhookAt/lastIncomingMessageAt from incoming logs and lastOutgoingMessageAt from outgoing logs", async () => {
    const repo = new InMemoryRepository();
    await repo.saveIntegrationLog({
      id: "1",
      connector: "whatsapp",
      direction: "incoming",
      payload: {},
      status: "success",
      createdAt: "2026-07-15T00:00:00.000Z",
    });
    await repo.saveIntegrationLog({
      id: "2",
      connector: "whatsapp",
      direction: "outgoing",
      payload: {},
      status: "success",
      latencyMs: 120,
      createdAt: "2026-07-15T00:01:00.000Z",
    });

    const manager = new ConnectorManager(repo);
    const telemetry = await manager.getTelemetry("whatsapp");
    expect(telemetry.lastWebhookAt).toBe("2026-07-15T00:00:00.000Z");
    expect(telemetry.lastIncomingMessageAt).toBe("2026-07-15T00:00:00.000Z");
    expect(telemetry.lastOutgoingMessageAt).toBe("2026-07-15T00:01:00.000Z");
    expect(telemetry.lastLatencyMs).toBe(120);
  });

  it("distinguishes an accepted incoming webhook from a rejected one for lastIncomingMessageAt", async () => {
    const repo = new InMemoryRepository();
    await repo.saveIntegrationLog({
      id: "1",
      connector: "whatsapp",
      direction: "incoming",
      payload: {},
      status: "error",
      error: "unrecognized payload",
      createdAt: "2026-07-15T00:00:00.000Z",
    });

    const manager = new ConnectorManager(repo);
    const telemetry = await manager.getTelemetry("whatsapp");
    expect(telemetry.lastWebhookAt).toBe("2026-07-15T00:00:00.000Z"); // still counts as "a webhook arrived"
    expect(telemetry.lastIncomingMessageAt).toBeNull(); // but not as "a message was accepted"
    expect(telemetry.lastError).toEqual({ message: "unrecognized payload", at: "2026-07-15T00:00:00.000Z" });
  });

  it("scopes telemetry to the requested connector only", async () => {
    const repo = new InMemoryRepository();
    await repo.saveIntegrationLog({
      id: "1",
      connector: "telegram",
      direction: "incoming",
      payload: {},
      status: "success",
      createdAt: "2026-07-15T00:00:00.000Z",
    });

    const manager = new ConnectorManager(repo);
    const telemetry = await manager.getTelemetry("whatsapp");
    expect(telemetry.lastWebhookAt).toBeNull();
  });
});

describe("ConnectorManager — status", () => {
  it("reports 'mock' when unconfigured and healthy", async () => {
    const manager = new ConnectorManager(new InMemoryRepository());
    const status = await manager.getStatus("whatsapp");
    expect(status.status).toBe("mock");
    expect(status.configured).toBe(false);
    expect(status.missingEnv.length).toBeGreaterThan(0);
  });

  it("reports 'error' when the connector's health check fails", async () => {
    const failingHealth = fakeConnector({ healthCheck: async () => ({ ok: false, detail: "boom" }) });
    const manager = new ConnectorManager(new InMemoryRepository(), { whatsapp: failingHealth });
    const status = await manager.getStatus("whatsapp");
    expect(status.status).toBe("error");
  });

  it("reports 'disconnected' once disabled, and skips the health check", async () => {
    const manager = new ConnectorManager(new InMemoryRepository());
    manager.disable("telegram");
    const status = await manager.getStatus("telegram");
    expect(status.status).toBe("disconnected");
    expect(status.health).toBeNull();
    expect(manager.isEnabled("telegram")).toBe(false);

    manager.enable("telegram");
    expect(manager.isEnabled("telegram")).toBe(true);
  });

  it("getAllStatuses returns one report per connector type", async () => {
    const manager = new ConnectorManager(new InMemoryRepository());
    const statuses = await manager.getAllStatuses();
    expect(statuses.map((s) => s.type).sort()).toEqual(["email", "meta", "mkconnect", "ota", "telegram", "whatsapp"]);
  });

  it("disableIfUnhealthy disables only when the health check fails", async () => {
    const healthy = new ConnectorManager(new InMemoryRepository());
    expect(await healthy.disableIfUnhealthy("whatsapp")).toBe(false);
    expect(healthy.isEnabled("whatsapp")).toBe(true);

    const failingHealth = fakeConnector({ healthCheck: async () => ({ ok: false, detail: "boom" }) });
    const unhealthy = new ConnectorManager(new InMemoryRepository(), { whatsapp: failingHealth });
    expect(await unhealthy.disableIfUnhealthy("whatsapp")).toBe(true);
    expect(unhealthy.isEnabled("whatsapp")).toBe(false);
  });
});

describe("ConnectorManager — route/retry", () => {
  it("route refuses to dispatch to a disabled connector", async () => {
    const manager = new ConnectorManager(new InMemoryRepository());
    manager.disable("whatsapp");
    const result = await manager.route("whatsapp", "sendMessage", { recipient: "x", content: { kind: "text", text: "hi" } });
    expect(result.success).toBe(false);
    expect(result.error).toContain("disabled");
  });

  it("route returns the connector's result directly on success and enqueues nothing", async () => {
    const repo = new InMemoryRepository();
    const manager = new ConnectorManager(repo);
    const result = await manager.route("whatsapp", "sendMessage", { recipient: "x", content: { kind: "text", text: "hi" } });
    expect(result.success).toBe(true);
    expect(await manager.pendingRetryCount("whatsapp")).toBe(0);
  });

  it("route enqueues a retry job when the dispatch fails, and retryNext eventually succeeds once the connector recovers", async () => {
    const repo = new InMemoryRepository();
    let shouldFail = true;
    const flaky = fakeConnector({
      sendMessage: async () => (shouldFail ? { success: false, error: "temporarily down" } : { success: true, externalId: "recovered" }),
    });
    const manager = new ConnectorManager(repo, { whatsapp: flaky });

    const firstAttempt = await manager.route("whatsapp", "sendMessage", { recipient: "x", content: { kind: "text", text: "hi" } });
    expect(firstAttempt.success).toBe(false);
    expect(await manager.pendingRetryCount("whatsapp")).toBe(1);

    shouldFail = false;
    const [job] = await repo.listJobs({ status: "pending", type: "connector-dispatch" });
    if (job) await repo.updateJob(job.id, { runAt: new Date().toISOString() });
    const retried = await manager.retryNext();
    expect(retried?.result.success).toBe(true);
    expect(await manager.pendingRetryCount("whatsapp")).toBe(0);
  });

  it("retryNext moves a job to the Dead Letter Queue once attempts are exhausted", async () => {
    const repo = new InMemoryRepository();
    const alwaysFails = fakeConnector({ sendMessage: async () => ({ success: false, error: "down" }) });
    const manager = new ConnectorManager(repo, { whatsapp: alwaysFails });

    await manager.route("whatsapp", "sendMessage", { recipient: "x", content: { kind: "text", text: "hi" } });

    // Each failed attempt re-queues with an exponential backoff runAt in the
    // future (see JobQueue.fail) — force it back to "now" between retries so
    // the test doesn't need to actually wait out the backoff delay.
    async function forceJobDue(): Promise<void> {
      const [job] = await repo.listJobs({ status: "pending", type: "connector-dispatch" });
      if (job) await repo.updateJob(job.id, { runAt: new Date().toISOString() });
    }

    // route()'s own failed dispatch only triggers the enqueue — it does not
    // count as a JobQueue attempt (the job starts at attempts=0). Default
    // QUEUE_MAX_ATTEMPTS is 5, so it takes exactly 5 retryNext() calls to
    // exhaust every attempt and land in the Dead Letter Queue.
    let lastResult;
    for (let i = 0; i < 5; i++) {
      await forceJobDue();
      lastResult = await manager.retryNext();
    }

    expect(lastResult?.result.success).toBe(false);
    expect(await manager.failedCount("whatsapp")).toBe(1);
    expect(await manager.pendingRetryCount("whatsapp")).toBe(0);
  });

  it("retryAllPendingFor only touches the given connector's own pending jobs", async () => {
    const repo = new InMemoryRepository();
    const alwaysFails = fakeConnector({ type: "whatsapp", sendMessage: async () => ({ success: false, error: "down" }) });
    const telegramFails = fakeConnector({ type: "telegram", sendMessage: async () => ({ success: false, error: "down" }) });
    const manager = new ConnectorManager(repo, { whatsapp: alwaysFails, telegram: telegramFails });

    await manager.route("whatsapp", "sendMessage", { recipient: "x", content: { kind: "text", text: "hi" } });
    await manager.route("telegram", "sendMessage", { recipient: "y", content: { kind: "text", text: "hi" } });

    // Force both jobs due immediately (skip the backoff delay).
    const pending = await repo.listJobs({ status: "pending", type: "connector-dispatch" });
    for (const job of pending) await repo.updateJob(job.id, { runAt: new Date().toISOString() });

    const whatsappResults = await manager.retryAllPendingFor("whatsapp");
    expect(whatsappResults).toHaveLength(1);
    expect(await manager.pendingRetryCount("whatsapp")).toBe(1); // re-queued after failing again
    expect(await manager.pendingRetryCount("telegram")).toBe(1); // untouched by the whatsapp-scoped retry
  });

  it("retryAllPendingFor skips jobs still within their backoff window", async () => {
    const repo = new InMemoryRepository();
    const alwaysFails = fakeConnector({ sendMessage: async () => ({ success: false, error: "down" }) });
    const manager = new ConnectorManager(repo, { whatsapp: alwaysFails });

    await manager.route("whatsapp", "sendMessage", { recipient: "x", content: { kind: "text", text: "hi" } });
    // Push runAt into the future to simulate a job still backing off after a prior failed retry.
    const [job] = await repo.listJobs({ status: "pending", type: "connector-dispatch" });
    if (job) await repo.updateJob(job.id, { runAt: new Date(Date.now() + 60_000).toISOString() });

    const results = await manager.retryAllPendingFor("whatsapp");
    expect(results).toHaveLength(0);
  });

  it("retryAllPendingFor reports failure immediately for a disabled connector without calling it", async () => {
    const repo = new InMemoryRepository();
    let calls = 0;
    const flaky = fakeConnector({
      sendMessage: async () => {
        calls++;
        return { success: false, error: "down" };
      },
    });
    const manager = new ConnectorManager(repo, { whatsapp: flaky });
    await manager.route("whatsapp", "sendMessage", { recipient: "x", content: { kind: "text", text: "hi" } });
    const [job] = await repo.listJobs({ status: "pending", type: "connector-dispatch" });
    if (job) await repo.updateJob(job.id, { runAt: new Date().toISOString() });

    manager.disable("whatsapp");
    calls = 0; // reset after the initial route() call
    const results = await manager.retryAllPendingFor("whatsapp");
    expect(results[0]?.result.success).toBe(false);
    expect(calls).toBe(0); // never actually dispatched to the disabled connector
  });

  it("retryNext returns null when there is nothing to retry", async () => {
    const manager = new ConnectorManager(new InMemoryRepository());
    expect(await manager.retryNext()).toBeNull();
  });

  it("retryNext fails the job immediately if the connector was disabled after it was queued", async () => {
    const repo = new InMemoryRepository();
    const alwaysFails = fakeConnector({ sendMessage: async () => ({ success: false, error: "down" }) });
    const manager = new ConnectorManager(repo, { whatsapp: alwaysFails });

    await manager.route("whatsapp", "sendMessage", { recipient: "x", content: { kind: "text", text: "hi" } });
    manager.disable("whatsapp");

    const [job] = await repo.listJobs({ status: "pending", type: "connector-dispatch" });
    if (job) await repo.updateJob(job.id, { runAt: new Date().toISOString() });
    const retried = await manager.retryNext();
    expect(retried?.result.success).toBe(false);
    expect(retried?.result.error).toContain("disabled");
  });
});
