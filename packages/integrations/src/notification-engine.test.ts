import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "@mkh/database";
import type { OutboundMessageContent } from "@mkh/shared";
import { ConnectorManager } from "./connector-manager";
import { NotificationEngine } from "./notification-engine";

describe("NotificationEngine", () => {
  it("sends a text message via sendMessage and logs it as an outgoing integration request", async () => {
    const repo = new InMemoryRepository();
    const engine = new NotificationEngine(new ConnectorManager(repo));
    const result = await engine.send({ connector: "whatsapp", recipient: "+62-812", content: { kind: "text", text: "hello" } });
    expect(result.success).toBe(true);

    const logs = await repo.listIntegrationLogs({ connector: "whatsapp", direction: "outgoing" });
    expect(logs).toHaveLength(1);
  });

  it("routes image and pdf content through sendMedia", async () => {
    const repo = new InMemoryRepository();
    const engine = new NotificationEngine(new ConnectorManager(repo));

    const image = await engine.send({ connector: "telegram", recipient: "chat-1", content: { kind: "image", url: "https://x/y.png", caption: "c" } });
    const pdf = await engine.send({ connector: "email", recipient: "a@b.com", content: { kind: "pdf", url: "https://x/y.pdf", filename: "report.pdf" } });

    expect(image.success).toBe(true);
    expect(pdf.success).toBe(true);
  });

  it("routes template content through sendTemplate", async () => {
    const repo = new InMemoryRepository();
    const engine = new NotificationEngine(new ConnectorManager(repo));
    const result = await engine.send({
      connector: "whatsapp",
      recipient: "+62-812",
      content: { kind: "template", templateName: "welcome", params: { name: "Budi" } },
    });
    expect(result.success).toBe(true);
  });

  it("routes buttons content through sendMessage (no dedicated interactive-message connector capability yet)", async () => {
    const repo = new InMemoryRepository();
    const engine = new NotificationEngine(new ConnectorManager(repo));
    const content: OutboundMessageContent = { kind: "buttons", text: "Choose one", buttons: [{ id: "yes", label: "Yes" }] };
    const result = await engine.send({ connector: "whatsapp", recipient: "+62-812", content });
    expect(result.success).toBe(true);
  });

  it("is not WhatsApp-specific — the same call shape works for every connector type", async () => {
    const repo = new InMemoryRepository();
    const engine = new NotificationEngine(new ConnectorManager(repo));
    const connectors = ["whatsapp", "telegram", "email", "meta", "mkconnect", "ota"] as const;
    for (const connector of connectors) {
      const result = await engine.send({ connector, recipient: "x", content: { kind: "text", text: "hi" } });
      expect(result.success).toBe(true);
    }
  });

  it("propagates a failed dispatch (e.g. a disabled connector) without throwing", async () => {
    const repo = new InMemoryRepository();
    const manager = new ConnectorManager(repo);
    manager.disable("whatsapp");
    const engine = new NotificationEngine(manager);
    const result = await engine.send({ connector: "whatsapp", recipient: "+62-812", content: { kind: "text", text: "hi" } });
    expect(result.success).toBe(false);
    expect(result.error).toContain("disabled");
  });
});
