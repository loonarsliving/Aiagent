import { afterEach, describe, expect, it } from "vitest";
import type { NotificationMessage } from "@mkh/shared";
import { emailChannel } from "./email";
import { pushChannel } from "./push";
import { telegramChannel } from "./telegram";
import { whatsappChannel } from "./whatsapp";

function message(overrides: Partial<NotificationMessage> = {}): NotificationMessage {
  return { id: "ntf_1", channel: "dummy", severity: "info", title: "T", body: "B", createdAt: "2026-07-12T00:00:00.000Z", ...overrides };
}

afterEach(() => {
  delete process.env.EMAIL_PROVIDER_API_KEY;
  delete process.env.EMAIL_FROM_ADDRESS;
  delete process.env.PUSH_PROVIDER_API_KEY;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.WHATSAPP_BUSINESS_TOKEN;
  delete process.env.WHATSAPP_BUSINESS_PHONE_ID;
});

describe("emailChannel", () => {
  it("stays undelivered when EMAIL_PROVIDER_API_KEY / EMAIL_FROM_ADDRESS are unset", async () => {
    const result = await emailChannel.send(message());
    expect(result.delivered).toBe(false);
  });

  it("takes the configured branch once both env vars are set, still without a live send call", async () => {
    process.env.EMAIL_PROVIDER_API_KEY = "test-key";
    process.env.EMAIL_FROM_ADDRESS = "noreply@example.com";
    const result = await emailChannel.send(message());
    expect(result.delivered).toBe(false);
    expect(result.detail).toContain("not yet wired");
  });
});

describe("pushChannel", () => {
  it("stays undelivered when PUSH_PROVIDER_API_KEY is unset", async () => {
    const result = await pushChannel.send(message());
    expect(result.delivered).toBe(false);
  });

  it("takes the configured branch once the env var is set", async () => {
    process.env.PUSH_PROVIDER_API_KEY = "test-key";
    const result = await pushChannel.send(message());
    expect(result.delivered).toBe(false);
    expect(result.detail).toContain("not yet wired");
  });
});

describe("telegramChannel", () => {
  it("takes the configured branch once both env vars are set", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "token";
    process.env.TELEGRAM_CHAT_ID = "chat";
    const result = await telegramChannel.send(message());
    expect(result.delivered).toBe(false);
    expect(result.detail).toContain("not yet wired");
  });
});

describe("whatsappChannel", () => {
  it("takes the configured branch once both env vars are set", async () => {
    process.env.WHATSAPP_BUSINESS_TOKEN = "token";
    process.env.WHATSAPP_BUSINESS_PHONE_ID = "phone";
    const result = await whatsappChannel.send(message());
    expect(result.delivered).toBe(false);
    expect(result.detail).toContain("not yet wired");
  });
});
