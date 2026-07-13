import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryRepository } from "@mkh/database";
import { CONNECTOR_TYPES, type ConnectorType } from "@mkh/shared";
import { createConnectorRegistry } from "../registry";
import type { Connector } from "../connector";
import { MockWhatsAppConnector } from "./mock/whatsapp.mock";

/**
 * All six mock connectors share one implementation (BaseMockConnector), so
 * one parametrized contract test exercises every connector identically —
 * exactly like the Repository interface's dual-implementation test suite.
 * This is the "Support manual testing" requirement from the Sprint 4A
 * brief made concrete: every capability is directly callable and
 * observable via the integration log, with zero network dependency.
 */
describe.each(CONNECTOR_TYPES)("mock connector — %s", (type: ConnectorType) => {
  let repo: InMemoryRepository;
  let connector: Connector;

  beforeEach(() => {
    repo = new InMemoryRepository();
    connector = createConnectorRegistry(repo)[type];
  });

  it("reports its own type", () => {
    expect(connector.type).toBe(type);
  });

  it("sendMessage never calls out to a real API and logs the outgoing request", async () => {
    const result = await connector.sendMessage({ recipient: "user-1", content: { kind: "text", text: "hello" } });
    expect(result.success).toBe(true);
    expect(result.externalId).toBeTruthy();

    const logs = await repo.listIntegrationLogs({ connector: type, direction: "outgoing" });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe("success");
    expect(logs[0]?.responseStatus).toBe(200);
  });

  it("sendTemplate and sendMedia both log outgoing requests independently", async () => {
    await connector.sendTemplate({ recipient: "user-1", templateName: "welcome", params: { name: "Budi" } });
    await connector.sendMedia({ recipient: "user-1", url: "https://example.test/img.png", caption: "caption" });

    const logs = await repo.listIntegrationLogs({ connector: type, direction: "outgoing" });
    expect(logs).toHaveLength(2);
  });

  it("broadcast sends to every recipient and logs one outgoing request per recipient", async () => {
    const results = await connector.broadcast({ recipients: ["a", "b", "c"], content: { kind: "text", text: "hi all" } });
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.success)).toBe(true);

    const logs = await repo.listIntegrationLogs({ connector: type, direction: "outgoing" });
    expect(logs).toHaveLength(3);
  });

  it("receiveWebhook normalizes a recognized payload and logs the incoming request", async () => {
    const result = await connector.receiveWebhook({ rawPayload: { sender: "+62-812", text: "hello there" } });
    expect(result.accepted).toBe(true);
    expect(result.normalized?.sender).toBe("+62-812");
    expect(result.normalized?.content).toEqual({ kind: "text", text: "hello there" });

    const logs = await repo.listIntegrationLogs({ connector: type, direction: "incoming" });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe("success");
  });

  it("receiveWebhook rejects an unrecognized payload shape but still logs it as an error", async () => {
    const result = await connector.receiveWebhook({ rawPayload: { garbage: true } });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBeTruthy();

    const logs = await repo.listIntegrationLogs({ connector: type, direction: "incoming" });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe("error");
  });

  it("healthCheck reports ok without any network call", async () => {
    const health = await connector.healthCheck();
    expect(health.ok).toBe(true);
    expect(health.detail).toContain(type);
  });
});

describe("BaseMockConnector — failure simulation (test-only hook)", () => {
  it("sendMessage reports failure and logs an error status when shouldFail() returns true", async () => {
    const repo = new InMemoryRepository();
    const connector = createConnectorRegistry(repo).whatsapp;
    // Re-create with a failing hook directly, since the registry doesn't expose options.
    const failing = new MockWhatsAppConnector(repo, { shouldFail: () => true });

    const result = await failing.sendMessage({ recipient: "x", content: { kind: "text", text: "hi" } });
    expect(result.success).toBe(false);
    expect(result.error).toContain("simulated delivery failure");

    const logs = await repo.listIntegrationLogs({ connector: "whatsapp", direction: "outgoing" });
    expect(logs[0]?.status).toBe("error");
    expect(logs[0]?.responseStatus).toBe(502);

    expect(connector.type).toBe("whatsapp"); // sanity: the non-failing instance is unaffected
  });
});
