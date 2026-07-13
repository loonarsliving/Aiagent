import { afterEach, describe, expect, it, vi } from "vitest";
import { resetConfigCache } from "@mkh/shared";
import { getRepository, resetRepositoryCache } from "@mkh/database";
import * as aiRefinement from "./ai-refinement";
import { notify } from "./notification-service";

afterEach(() => {
  delete process.env.NOTIFY_CHANNEL_DEFAULT;
  delete process.env.WHATSAPP_BUSINESS_TOKEN;
  delete process.env.WHATSAPP_BUSINESS_PHONE_ID;
  delete process.env.NOTIFY_AI_REFINEMENT_ENABLED;
  resetConfigCache();
  resetRepositoryCache();
  vi.restoreAllMocks();
});

describe("notify", () => {
  it("persists the message before attempting delivery, defaulting to the dummy channel and info severity", async () => {
    resetRepositoryCache();
    const message = await notify({ title: "Test", body: "Body text" });

    expect(message.channel).toBe("dummy");
    expect(message.severity).toBe("info");

    const persisted = await getRepository().listNotifications(5);
    expect(persisted.some((n) => n.id === message.id)).toBe(true);
  });

  it("respects an explicit severity and sourceModuleId", async () => {
    resetRepositoryCache();
    const message = await notify({ title: "T", body: "B", severity: "critical", sourceModuleId: "finance-analyst" });
    expect(message.severity).toBe("critical");
    expect(message.sourceModuleId).toBe("finance-analyst");
  });

  it("lets a single call override the configured default channel", async () => {
    resetRepositoryCache();
    process.env.NOTIFY_CHANNEL_DEFAULT = "dummy";
    resetConfigCache();
    const message = await notify({ title: "T", body: "B", channel: "whatsapp" });
    expect(message.channel).toBe("whatsapp");
  });

  it("does not throw when dispatching to an unconfigured real channel (e.g. WhatsApp with no token) — it just stays undelivered", async () => {
    resetRepositoryCache();
    delete process.env.WHATSAPP_BUSINESS_TOKEN;
    delete process.env.WHATSAPP_BUSINESS_PHONE_ID;
    await expect(notify({ title: "T", body: "B", channel: "whatsapp" })).resolves.toBeDefined();
  });

  it("persists even when the notification is never actually delivered", async () => {
    resetRepositoryCache();
    const message = await notify({ title: "Undelivered", body: "B", channel: "telegram" });
    const persisted = await getRepository().listNotifications(5);
    expect(persisted.some((n) => n.id === message.id && n.title === "Undelivered")).toBe(true);
  });

  it("skips the AI wording-refinement call entirely when NOTIFY_AI_REFINEMENT_ENABLED=false", async () => {
    resetRepositoryCache();
    process.env.NOTIFY_AI_REFINEMENT_ENABLED = "false";
    resetConfigCache();
    const spy = vi.spyOn(aiRefinement, "refineNotificationWording");

    const message = await notify({ title: "Original Title", body: "Original Body" });

    expect(spy).not.toHaveBeenCalled();
    expect(message.title).toBe("Original Title");
    expect(message.body).toBe("Original Body");
  });

  it("attempts the AI wording-refinement call when NOTIFY_AI_REFINEMENT_ENABLED is unset (defaults to true)", async () => {
    resetRepositoryCache();
    const spy = vi.spyOn(aiRefinement, "refineNotificationWording");

    await notify({ title: "T", body: "B" });

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
