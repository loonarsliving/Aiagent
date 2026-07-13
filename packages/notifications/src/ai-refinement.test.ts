import { describe, expect, it } from "vitest";
import type { AIGenerateRequest, AIGenerateResponse, AIProvider } from "@mkh/ai-provider";
import { refineNotificationWording } from "./ai-refinement";

function fakeProvider(generate: (req: AIGenerateRequest) => Promise<AIGenerateResponse>): AIProvider {
  return {
    name: "gemini",
    generate,
    async healthCheck() {
      return { ok: true, detail: "ok" };
    },
  };
}

const baseResponse: Omit<AIGenerateResponse, "text"> = {
  provider: "gemini",
  model: "gemini-flash-latest",
  responseTimeMs: 10,
};

describe("refineNotificationWording", () => {
  it("returns refined title/body when the provider responds with valid JSON", async () => {
    const provider = fakeProvider(async () => ({
      ...baseResponse,
      text: JSON.stringify({ title: "Judul Halus", body: "Isi yang lebih jelas." }),
    }));

    const result = await refineNotificationWording(
      { title: "Judul Asli", body: "Isi asli", severity: "warning" },
      provider,
    );

    expect(result).toEqual({ title: "Judul Halus", body: "Isi yang lebih jelas.", refined: true });
  });

  it("strips a markdown code fence before parsing", async () => {
    const provider = fakeProvider(async () => ({
      ...baseResponse,
      text: '```json\n{"title": "T", "body": "B"}\n```',
    }));

    const result = await refineNotificationWording({ title: "orig", body: "orig", severity: "info" }, provider);
    expect(result).toEqual({ title: "T", body: "B", refined: true });
  });

  it("falls back to the original wording when the provider throws", async () => {
    const provider = fakeProvider(async () => {
      throw new Error("simulated provider failure");
    });

    const result = await refineNotificationWording(
      { title: "Judul Asli", body: "Isi asli", severity: "info", target: "owner" },
      provider,
    );

    expect(result).toEqual({ title: "Judul Asli", body: "Isi asli", refined: false });
  });

  it("falls back to the original wording when the response is not valid JSON", async () => {
    const provider = fakeProvider(async () => ({ ...baseResponse, text: "not json at all" }));

    const result = await refineNotificationWording({ title: "orig", body: "orig", severity: "info" }, provider);
    expect(result).toEqual({ title: "orig", body: "orig", refined: false });
  });

  it("falls back to the original wording when the JSON is missing title/body", async () => {
    const provider = fakeProvider(async () => ({ ...baseResponse, text: JSON.stringify({ foo: "bar" }) }));

    const result = await refineNotificationWording({ title: "orig", body: "orig", severity: "info" }, provider);
    expect(result).toEqual({ title: "orig", body: "orig", refined: false });
  });

  it("falls back to the original wording when title/body are present but empty", async () => {
    const provider = fakeProvider(async () => ({ ...baseResponse, text: JSON.stringify({ title: "  ", body: "" }) }));

    const result = await refineNotificationWording({ title: "orig", body: "orig", severity: "info" }, provider);
    expect(result).toEqual({ title: "orig", body: "orig", refined: false });
  });

  it("passes severity and target through to the prompt without altering them in the output", async () => {
    let capturedPrompt = "";
    const provider = fakeProvider(async (req) => {
      capturedPrompt = req.userPrompt;
      return { ...baseResponse, text: JSON.stringify({ title: "T", body: "B" }) };
    });

    await refineNotificationWording({ title: "orig", body: "orig", severity: "critical", target: "dir_ops" }, provider);
    expect(capturedPrompt).toContain("Severity: critical");
    expect(capturedPrompt).toContain("Target: dir_ops");
  });

  it("uses getAIProvider() when no override is supplied and still resolves gracefully without a key", async () => {
    const result = await refineNotificationWording({ title: "orig", body: "orig", severity: "info" });
    // No GEMINI_API_KEY in the test environment -> getAIProvider() throws synchronously -> caught -> fallback.
    expect(result).toEqual({ title: "orig", body: "orig", refined: false });
  });
});
