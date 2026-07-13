import { afterEach, describe, expect, it } from "vitest";
import { InMemoryRepository } from "@mkh/database";
import { ConnectorManager } from "./connector-manager";
import { handleWhatsAppWebhookEvent, verifyWhatsAppWebhookChallenge } from "./whatsapp-webhook-handler";
import { MockWhatsAppConnector } from "./connectors/mock/whatsapp.mock";
import { WhatsAppCloudConnector } from "./connectors/whatsapp-cloud-connector";
import type { WhatsAppHttpClient, WhatsAppHttpResponse } from "./connectors/whatsapp-http-client";

function textWebhookPayload(from: string, text: string) {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "1", changes: [{ value: { messages: [{ from, type: "text", text: { body: text } }] }, field: "messages" }] }],
  };
}

function fakeHttpClient(overrides: Partial<WhatsAppHttpClient> = {}): WhatsAppHttpClient {
  return {
    async get(): Promise<WhatsAppHttpResponse> {
      return { status: 200, ok: true, json: { verified_name: "MKH" } };
    },
    async post(): Promise<WhatsAppHttpResponse> {
      return { status: 200, ok: true, json: { messages: [{ id: "wamid.REPLY" }] } };
    },
    ...overrides,
  };
}

// The mock connector's BaseMockConnector.normalize() only understands a
// flat `{ sender, text }` shape (see base-mock-connector.ts) — the full
// nested Meta Cloud API payload shape is specific to the real
// WhatsAppCloudConnector's normalizeIncomingMessage(), tested separately below.
function mockWebhookPayload(sender: string, text: string) {
  return { sender, text };
}

describe("handleWhatsAppWebhookEvent — end-to-end pipeline (mock connector)", () => {
  it("ingests a text message, opens a conversation, routes it, and sends a reply through the mock connector", async () => {
    const repo = new InMemoryRepository();
    const manager = new ConnectorManager(repo);

    const result = await handleWhatsAppWebhookEvent(repo, manager, mockWebhookPayload("+62812", "saya mau ajukan cuti"));

    expect(result.status).toBe("processed");
    expect(result.assignedAgent).toBe("hr-officer");
    expect(result.replySent).toBe(true);

    const conversation = await repo.getConversation(result.conversationId!);
    expect(conversation?.sender).toBe("+62812");
    expect(conversation?.status).toBe("routed");
    expect(conversation?.history).toHaveLength(1);

    // one incoming log (the webhook) + one outgoing log (the reply)
    const incoming = await repo.listIntegrationLogs({ connector: "whatsapp", direction: "incoming" });
    const outgoing = await repo.listIntegrationLogs({ connector: "whatsapp", direction: "outgoing" });
    expect(incoming).toHaveLength(1);
    expect(outgoing).toHaveLength(1);
  });

  it("does not open a conversation or send a reply when the payload is unrecognized", async () => {
    const repo = new InMemoryRepository();
    const manager = new ConnectorManager(repo);

    const result = await handleWhatsAppWebhookEvent(repo, manager, { garbage: true });
    expect(result.status).toBe("ignored");

    expect(await repo.listConversations({ connector: "whatsapp" })).toHaveLength(0);
    expect(await repo.listIntegrationLogs({ connector: "whatsapp", direction: "outgoing" })).toHaveLength(0);
  });

  it("still processes and replies (with a generic acknowledgment) when no keyword matches any agent", async () => {
    const repo = new InMemoryRepository();
    const manager = new ConnectorManager(repo);

    const result = await handleWhatsAppWebhookEvent(repo, manager, mockWebhookPayload("+62812", "halo, apa kabar?"));
    expect(result.status).toBe("processed");
    expect(result.assignedAgent).toBeNull();
    expect(result.replySent).toBe(true);
  });

  it("appends a second message from the same sender to the same conversation instead of opening a new one", async () => {
    const repo = new InMemoryRepository();
    const manager = new ConnectorManager(repo);

    const first = await handleWhatsAppWebhookEvent(repo, manager, mockWebhookPayload("+62812", "halo"));
    const second = await handleWhatsAppWebhookEvent(repo, manager, mockWebhookPayload("+62812", "saya mau tanya soal target sales"));

    expect(second.conversationId).toBe(first.conversationId);
    const conversation = await repo.getConversation(first.conversationId!);
    expect(conversation?.history).toHaveLength(2);
    expect(conversation?.assignedAgent).toBe("sales-supervisor");
  });
});

describe("handleWhatsAppWebhookEvent — end-to-end pipeline (live connector)", () => {
  afterEach(() => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    delete process.env.WHATSAPP_VERIFY_TOKEN;
  });

  it("routes the reply through the real WhatsAppCloudConnector when it's active, recording latency on the outgoing log", async () => {
    const repo = new InMemoryRepository();
    const live = new WhatsAppCloudConnector(
      repo,
      { accessToken: "t", phoneNumberId: "123", businessAccountId: "456", verifyToken: "v" },
      fakeHttpClient(),
    );
    const manager = new ConnectorManager(repo, { whatsapp: live });

    const result = await handleWhatsAppWebhookEvent(repo, manager, textWebhookPayload("+62812", "ada anomali transaksi"));
    expect(result.status).toBe("processed");
    expect(result.assignedAgent).toBe("finance-analyst");
    expect(result.replySent).toBe(true);

    const outgoing = await repo.listIntegrationLogs({ connector: "whatsapp", direction: "outgoing" });
    expect(outgoing[0]?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("reports processed but replySent=false when the live connector's send fails", async () => {
    const repo = new InMemoryRepository();
    const live = new WhatsAppCloudConnector(
      repo,
      { accessToken: "t", phoneNumberId: "123", businessAccountId: "456", verifyToken: "v" },
      fakeHttpClient({ post: async () => ({ status: 500, ok: false, json: { error: { message: "internal error" } } }) }),
    );
    const manager = new ConnectorManager(repo, { whatsapp: live });

    const result = await handleWhatsAppWebhookEvent(repo, manager, textWebhookPayload("+62812", "halo"));
    expect(result.status).toBe("processed");
    expect(result.replySent).toBe(false);
  });
});

describe("verifyWhatsAppWebhookChallenge", () => {
  it("returns false when the active connector is the mock (no real verify token exists to check)", () => {
    const repo = new InMemoryRepository();
    const manager = new ConnectorManager(repo, { whatsapp: new MockWhatsAppConnector(repo) });
    expect(verifyWhatsAppWebhookChallenge("subscribe", "anything", manager)).toBe(false);
  });

  it("delegates to the live connector's verifyWebhook when it's active", () => {
    const repo = new InMemoryRepository();
    const live = new WhatsAppCloudConnector(
      repo,
      { accessToken: "t", phoneNumberId: "123", businessAccountId: "456", verifyToken: "correct-token" },
      fakeHttpClient(),
    );
    const manager = new ConnectorManager(repo, { whatsapp: live });

    expect(verifyWhatsAppWebhookChallenge("subscribe", "correct-token", manager)).toBe(true);
    expect(verifyWhatsAppWebhookChallenge("subscribe", "wrong-token", manager)).toBe(false);
  });
});
