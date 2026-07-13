import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "@mkh/database";
import type { WhatsAppHttpClient, WhatsAppHttpResponse } from "./whatsapp-http-client";
import { WhatsAppCloudConnector } from "./whatsapp-cloud-connector";

function config() {
  return { accessToken: "test-token", phoneNumberId: "1234567890", businessAccountId: "999", verifyToken: "verify-secret" };
}

function fakeHttpClient(overrides: Partial<WhatsAppHttpClient> = {}): WhatsAppHttpClient {
  return {
    async get(): Promise<WhatsAppHttpResponse> {
      return { status: 200, ok: true, json: { verified_name: "MKH", display_phone_number: "+62..." } };
    },
    async post(): Promise<WhatsAppHttpResponse> {
      return { status: 200, ok: true, json: { messages: [{ id: "wamid.TEST123" }] } };
    },
    ...overrides,
  };
}

describe("WhatsAppCloudConnector — healthCheck", () => {
  it("reports ok and logs a successful outgoing check with latency, calling GET on the phone number id", async () => {
    const repo = new InMemoryRepository();
    let requestedPath = "";
    const http = fakeHttpClient({
      get: async (path) => {
        requestedPath = path;
        return { status: 200, ok: true, json: { verified_name: "MKH" } };
      },
    });
    const connector = new WhatsAppCloudConnector(repo, config(), http);

    const health = await connector.healthCheck();
    expect(health.ok).toBe(true);
    expect(requestedPath).toBe("/1234567890?fields=verified_name,display_phone_number");

    const logs = await repo.listIntegrationLogs({ connector: "whatsapp", direction: "outgoing" });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe("success");
    expect(logs[0]?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("reports not ok and logs the Graph API error when the response is not ok", async () => {
    const repo = new InMemoryRepository();
    const http = fakeHttpClient({
      get: async () => ({ status: 401, ok: false, json: { error: { message: "Invalid OAuth access token" } } }),
    });
    const connector = new WhatsAppCloudConnector(repo, config(), http);

    const health = await connector.healthCheck();
    expect(health.ok).toBe(false);
    expect(health.detail).toContain("Invalid OAuth access token");

    const logs = await repo.listIntegrationLogs({ connector: "whatsapp", direction: "outgoing" });
    expect(logs[0]?.status).toBe("error");
    expect(logs[0]?.error).toContain("Invalid OAuth access token");
  });

  it("reports not ok and logs the exception message when the HTTP call itself throws (network failure)", async () => {
    const repo = new InMemoryRepository();
    const http = fakeHttpClient({
      get: async () => {
        throw new Error("ETIMEDOUT");
      },
    });
    const connector = new WhatsAppCloudConnector(repo, config(), http);

    const health = await connector.healthCheck();
    expect(health.ok).toBe(false);
    expect(health.detail).toContain("ETIMEDOUT");

    const logs = await repo.listIntegrationLogs({ connector: "whatsapp", direction: "outgoing" });
    expect(logs[0]?.error).toBe("ETIMEDOUT");
  });
});

describe("WhatsAppCloudConnector — connect/disconnect", () => {
  it("connect() resolves when the health check passes", async () => {
    const repo = new InMemoryRepository();
    const connector = new WhatsAppCloudConnector(repo, config(), fakeHttpClient());
    await expect(connector.connect()).resolves.toBeUndefined();
  });

  it("connect() throws when the health check fails", async () => {
    const repo = new InMemoryRepository();
    const http = fakeHttpClient({ get: async () => ({ status: 401, ok: false, json: {} }) });
    const connector = new WhatsAppCloudConnector(repo, config(), http);
    await expect(connector.connect()).rejects.toThrow();
  });

  it("disconnect() resolves without error (nothing to tear down)", async () => {
    const repo = new InMemoryRepository();
    const connector = new WhatsAppCloudConnector(repo, config(), fakeHttpClient());
    await expect(connector.disconnect()).resolves.toBeUndefined();
  });
});

describe("WhatsAppCloudConnector — sendMessage/sendTemplate/sendMedia/broadcast", () => {
  it("sendMessage posts to /{phoneNumberId}/messages with a text body and logs it", async () => {
    const repo = new InMemoryRepository();
    let postedPath = "";
    let postedBody: unknown;
    const http = fakeHttpClient({
      post: async (path, body) => {
        postedPath = path;
        postedBody = body;
        return { status: 200, ok: true, json: { messages: [{ id: "wamid.ABC" }] } };
      },
    });
    const connector = new WhatsAppCloudConnector(repo, config(), http);

    const result = await connector.sendMessage({ recipient: "+62812", content: { kind: "text", text: "halo" } });
    expect(result.success).toBe(true);
    expect(result.externalId).toBe("wamid.ABC");
    expect(postedPath).toBe("/1234567890/messages");
    expect(postedBody).toMatchObject({ messaging_product: "whatsapp", to: "+62812", type: "text", text: { body: "halo" } });

    const logs = await repo.listIntegrationLogs({ connector: "whatsapp", direction: "outgoing" });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe("success");
  });

  it("sendTemplate maps params positionally into template body parameters", async () => {
    const repo = new InMemoryRepository();
    let postedBody: unknown;
    const http = fakeHttpClient({
      post: async (_path, body) => {
        postedBody = body;
        return { status: 200, ok: true, json: { messages: [{ id: "wamid.T" }] } };
      },
    });
    const connector = new WhatsAppCloudConnector(repo, config(), http);

    await connector.sendTemplate({ recipient: "+62812", templateName: "welcome", params: { name: "Budi", branch: "Kendari" } });
    expect(postedBody).toMatchObject({
      type: "template",
      template: {
        name: "welcome",
        components: [{ type: "body", parameters: [{ type: "text", text: "Budi" }, { type: "text", text: "Kendari" }] }],
      },
    });
  });

  it("sendMedia posts an image message", async () => {
    const repo = new InMemoryRepository();
    let postedBody: unknown;
    const http = fakeHttpClient({
      post: async (_path, body) => {
        postedBody = body;
        return { status: 200, ok: true, json: { messages: [{ id: "wamid.M" }] } };
      },
    });
    const connector = new WhatsAppCloudConnector(repo, config(), http);

    await connector.sendMedia({ recipient: "+62812", url: "https://x/y.png", caption: "lihat ini" });
    expect(postedBody).toMatchObject({ type: "image", image: { link: "https://x/y.png", caption: "lihat ini" } });
  });

  it("broadcast sends to every recipient and logs one outgoing request each", async () => {
    const repo = new InMemoryRepository();
    const connector = new WhatsAppCloudConnector(repo, config(), fakeHttpClient());

    const results = await connector.broadcast({ recipients: ["a", "b", "c"], content: { kind: "text", text: "hi all" } });
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.success)).toBe(true);

    const logs = await repo.listIntegrationLogs({ connector: "whatsapp", direction: "outgoing" });
    expect(logs).toHaveLength(3);
  });

  it("reports failure and logs the Graph API error status when the send is rejected", async () => {
    const repo = new InMemoryRepository();
    const http = fakeHttpClient({
      post: async () => ({ status: 400, ok: false, json: { error: { message: "Recipient phone number not in allowed list" } } }),
    });
    const connector = new WhatsAppCloudConnector(repo, config(), http);

    const result = await connector.sendMessage({ recipient: "+62812", content: { kind: "text", text: "halo" } });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Recipient phone number not in allowed list");

    const logs = await repo.listIntegrationLogs({ connector: "whatsapp", direction: "outgoing" });
    expect(logs[0]?.responseStatus).toBe(400);
  });

  it("reports failure and logs a zero response status when the HTTP call itself throws", async () => {
    const repo = new InMemoryRepository();
    const http = fakeHttpClient({
      post: async () => {
        throw new Error("connection reset");
      },
    });
    const connector = new WhatsAppCloudConnector(repo, config(), http);

    const result = await connector.sendMessage({ recipient: "+62812", content: { kind: "text", text: "halo" } });
    expect(result.success).toBe(false);
    expect(result.error).toBe("connection reset");

    const logs = await repo.listIntegrationLogs({ connector: "whatsapp", direction: "outgoing" });
    expect(logs[0]?.responseStatus).toBe(0);
  });
});

describe("WhatsAppCloudConnector — normalizeOutgoingMessage", () => {
  it("maps pdf content to a document message", () => {
    const connector = new WhatsAppCloudConnector(new InMemoryRepository(), config(), fakeHttpClient());
    expect(connector.normalizeOutgoingMessage({ kind: "pdf", url: "https://x/report.pdf", filename: "report.pdf" })).toMatchObject({
      type: "document",
      document: { link: "https://x/report.pdf", filename: "report.pdf" },
    });
  });

  it("maps buttons content to an interactive button message", () => {
    const connector = new WhatsAppCloudConnector(new InMemoryRepository(), config(), fakeHttpClient());
    const result = connector.normalizeOutgoingMessage({ kind: "buttons", text: "Pilih satu", buttons: [{ id: "yes", label: "Ya" }] });
    expect(result).toMatchObject({
      type: "interactive",
      interactive: { type: "button", body: { text: "Pilih satu" }, action: { buttons: [{ type: "reply", reply: { id: "yes", title: "Ya" } }] } },
    });
  });

  it("maps a template with no params to an empty components array", () => {
    const connector = new WhatsAppCloudConnector(new InMemoryRepository(), config(), fakeHttpClient());
    const result = connector.normalizeOutgoingMessage({ kind: "template", templateName: "ping", params: {} });
    expect(result).toMatchObject({ type: "template", template: { name: "ping", components: [] } });
  });
});

describe("WhatsAppCloudConnector — verifyWebhook", () => {
  it("returns true only when mode is 'subscribe' and the token matches", () => {
    const connector = new WhatsAppCloudConnector(new InMemoryRepository(), config(), fakeHttpClient());
    expect(connector.verifyWebhook("subscribe", "verify-secret")).toBe(true);
    expect(connector.verifyWebhook("subscribe", "wrong-token")).toBe(false);
    expect(connector.verifyWebhook("unsubscribe", "verify-secret")).toBe(false);
    expect(connector.verifyWebhook(null, null)).toBe(false);
  });
});

describe("WhatsAppCloudConnector — receiveWebhook / normalizeIncomingMessage", () => {
  function textWebhookPayload(from: string, text: string) {
    return {
      object: "whatsapp_business_account",
      entry: [{ id: "1", changes: [{ value: { messages: [{ from, type: "text", text: { body: text } }] }, field: "messages" }] }],
    };
  }

  it("accepts and normalizes a valid text message webhook payload", async () => {
    const repo = new InMemoryRepository();
    const connector = new WhatsAppCloudConnector(repo, config(), fakeHttpClient());

    const result = await connector.receiveWebhook({ rawPayload: textWebhookPayload("+62812", "halo dunia") });
    expect(result.accepted).toBe(true);
    expect(result.normalized).toEqual({
      sender: "+62812",
      content: { kind: "text", text: "halo dunia" },
      receivedAt: expect.any(String),
    });

    const logs = await repo.listIntegrationLogs({ connector: "whatsapp", direction: "incoming" });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe("success");
  });

  it("preserves a non-text message (e.g. image) as raw JSON rather than dropping it", async () => {
    const repo = new InMemoryRepository();
    const connector = new WhatsAppCloudConnector(repo, config(), fakeHttpClient());
    const payload = {
      entry: [{ changes: [{ value: { messages: [{ from: "+62812", type: "image", image: { id: "media123" } }] } }] }],
    };

    const result = await connector.receiveWebhook({ rawPayload: payload });
    expect(result.accepted).toBe(true);
    expect(result.normalized?.content.kind).toBe("raw");
  });

  it("rejects a status-callback payload (no messages array) without throwing, and logs it as an error", async () => {
    const repo = new InMemoryRepository();
    const connector = new WhatsAppCloudConnector(repo, config(), fakeHttpClient());
    const statusPayload = { entry: [{ changes: [{ value: { statuses: [{ id: "wamid.X", status: "delivered" }] } }] }] };

    const result = await connector.receiveWebhook({ rawPayload: statusPayload });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBeTruthy();

    const logs = await repo.listIntegrationLogs({ connector: "whatsapp", direction: "incoming" });
    expect(logs[0]?.status).toBe("error");
  });

  it("rejects a completely malformed payload without throwing", async () => {
    const repo = new InMemoryRepository();
    const connector = new WhatsAppCloudConnector(repo, config(), fakeHttpClient());
    const result = await connector.receiveWebhook({ rawPayload: { garbage: true } });
    expect(result.accepted).toBe(false);
  });

  it("rejects a message with a non-string sender", () => {
    const connector = new WhatsAppCloudConnector(new InMemoryRepository(), config(), fakeHttpClient());
    const payload = { entry: [{ changes: [{ value: { messages: [{ from: 12345, type: "text", text: { body: "hi" } }] } }] }] };
    expect(connector.normalizeIncomingMessage(payload)).toBeNull();
  });

  it("normalizeIncomingMessage returns null for a non-object payload", () => {
    const connector = new WhatsAppCloudConnector(new InMemoryRepository(), config(), fakeHttpClient());
    expect(connector.normalizeIncomingMessage(null)).toBeNull();
    expect(connector.normalizeIncomingMessage("not an object")).toBeNull();
  });
});
