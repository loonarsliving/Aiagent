import { afterEach, describe, expect, it, vi } from "vitest";
import { createFetchWhatsAppHttpClient, WHATSAPP_GRAPH_API_BASE_URL } from "./whatsapp-http-client";

describe("createFetchWhatsAppHttpClient", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("GET sends a Bearer-authorized request to baseUrl + path and parses the JSON response", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ id: "123" }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createFetchWhatsAppHttpClient("secret-token");
    const result = await client.get("/123?fields=id");

    expect(result).toEqual({ status: 200, ok: true, json: { id: "123" } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${WHATSAPP_GRAPH_API_BASE_URL}/123?fields=id`);
    expect(init?.method).toBe("GET");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer secret-token" });
  });

  it("POST sends a JSON-serialized body and reports a non-2xx response as not ok", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ error: { message: "bad request" } }), { status: 400 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createFetchWhatsAppHttpClient("secret-token");
    const result = await client.post("/123/messages", { to: "x" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.body).toBe(JSON.stringify({ to: "x" }));
  });

  it("returns a null json body when the response isn't valid JSON, without throwing", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response("not json", { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createFetchWhatsAppHttpClient("secret-token");
    const result = await client.get("/123");
    expect(result.json).toBeNull();
  });

  it("honors a custom base URL", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response("{}", { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createFetchWhatsAppHttpClient("secret-token", "https://example.test/api");
    await client.get("/ping");
    expect(fetchMock.mock.calls[0]![0]).toBe("https://example.test/api/ping");
  });
});
