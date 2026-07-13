import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "@mkh/database";
import { AgentRegistry } from "./agent-registry";
import { AIRouter } from "./ai-router";
import { ConversationEngine } from "./conversation-engine";
import { createConnectorRegistry } from "./registry";
import { WebhookEngine } from "./webhook-engine";

function router(): AIRouter {
  const registry = new AgentRegistry();
  registry.register({ moduleId: "hr-officer", keywords: ["cuti"], description: "HR" });
  registry.register({ moduleId: "sales-supervisor", keywords: ["sales", "target"], description: "Sales" });
  return new AIRouter(registry);
}

describe("ConversationEngine — ingestMessage", () => {
  it("opens a new conversation on the first message from a sender", async () => {
    const repo = new InMemoryRepository();
    const engine = new ConversationEngine(repo, router());

    const conversation = await engine.ingestMessage("whatsapp", {
      sender: "+62-812",
      content: { kind: "text", text: "halo, ada info produk?" },
      receivedAt: "2026-07-14T00:00:00.000Z",
    });

    expect(conversation.sender).toBe("+62-812");
    expect(conversation.connector).toBe("whatsapp");
    expect(conversation.history).toHaveLength(1);
    expect(conversation.status).toBe("open"); // no keyword match yet
    expect(conversation.assignedAgent).toBeNull();
  });

  it("routes to an agent and flips status to 'routed' once a message matches a keyword", async () => {
    const repo = new InMemoryRepository();
    const engine = new ConversationEngine(repo, router());

    const conversation = await engine.ingestMessage("whatsapp", {
      sender: "+62-812",
      content: { kind: "text", text: "saya mau ajukan cuti" },
      receivedAt: "2026-07-14T00:00:00.000Z",
    });

    expect(conversation.assignedAgent).toBe("hr-officer");
    expect(conversation.status).toBe("routed");
  });

  it("appends subsequent messages from the same sender to the same conversation rather than creating a new one", async () => {
    const repo = new InMemoryRepository();
    const engine = new ConversationEngine(repo, router());

    const first = await engine.ingestMessage("whatsapp", { sender: "+62-812", content: { kind: "text", text: "halo" }, receivedAt: "t1" });
    const second = await engine.ingestMessage("whatsapp", {
      sender: "+62-812",
      content: { kind: "text", text: "saya mau tanya soal target sales" },
      receivedAt: "t2",
    });

    expect(second.id).toBe(first.id);
    expect(second.history).toHaveLength(2);
    expect(second.assignedAgent).toBe("sales-supervisor");

    const all = await repo.listConversations({ connector: "whatsapp" });
    expect(all).toHaveLength(1);
  });

  it("keeps separate conversations for different senders on the same connector", async () => {
    const repo = new InMemoryRepository();
    const engine = new ConversationEngine(repo, router());

    await engine.ingestMessage("whatsapp", { sender: "+62-812", content: { kind: "text", text: "halo" }, receivedAt: "t1" });
    await engine.ingestMessage("whatsapp", { sender: "+62-813", content: { kind: "text", text: "halo juga" }, receivedAt: "t2" });

    const all = await repo.listConversations({ connector: "whatsapp" });
    expect(all).toHaveLength(2);
  });

  it("does not reopen or append to a closed conversation — a new one starts instead", async () => {
    const repo = new InMemoryRepository();
    const engine = new ConversationEngine(repo, router());

    const first = await engine.ingestMessage("whatsapp", { sender: "+62-812", content: { kind: "text", text: "halo" }, receivedAt: "t1" });
    await engine.close(first.id);

    const second = await engine.ingestMessage("whatsapp", { sender: "+62-812", content: { kind: "text", text: "halo lagi" }, receivedAt: "t2" });
    expect(second.id).not.toBe(first.id);

    const all = await repo.listConversations({ connector: "whatsapp" });
    expect(all).toHaveLength(2);
  });

  it("close throws for an unknown conversation id", async () => {
    const repo = new InMemoryRepository();
    const engine = new ConversationEngine(repo, router());
    await expect(engine.close("nope")).rejects.toThrow("not found");
  });
});

describe("ConversationEngine — processNextWebhookJob", () => {
  it("claims a queued webhook message, ingests it, and completes the job", async () => {
    const repo = new InMemoryRepository();
    const connectors = createConnectorRegistry(repo);
    const webhookEngine = new WebhookEngine(repo, connectors);
    const conversationEngine = new ConversationEngine(repo, router());

    await webhookEngine.receive({ connector: "telegram", rawPayload: { sender: "chat-1", text: "saya mau ajukan cuti" } });

    const conversation = await conversationEngine.processNextWebhookJob(webhookEngine);
    expect(conversation?.assignedAgent).toBe("hr-officer");

    const job = (await repo.listJobs({ type: "webhook-inbound" }))[0];
    expect(job?.status).toBe("success");
  });

  it("returns null when there is nothing queued", async () => {
    const repo = new InMemoryRepository();
    const webhookEngine = new WebhookEngine(repo, createConnectorRegistry(repo));
    const conversationEngine = new ConversationEngine(repo, router());
    expect(await conversationEngine.processNextWebhookJob(webhookEngine)).toBeNull();
  });

  it("fails the underlying job (instead of losing it) and rethrows when ingestion itself throws", async () => {
    const repo = new InMemoryRepository();
    const originalSaveConversation = repo.saveConversation.bind(repo);
    repo.saveConversation = async () => {
      throw new Error("persistence exploded");
    };

    const webhookEngine = new WebhookEngine(repo, createConnectorRegistry(repo));
    const conversationEngine = new ConversationEngine(repo, router());
    await webhookEngine.receive({ connector: "telegram", rawPayload: { sender: "chat-1", text: "halo" } });

    await expect(conversationEngine.processNextWebhookJob(webhookEngine)).rejects.toThrow("persistence exploded");

    repo.saveConversation = originalSaveConversation;
    const job = (await repo.listJobs({ type: "webhook-inbound" }))[0];
    expect(job?.status).toBe("pending"); // re-queued for retry, not lost
    expect(job?.lastError).toBe("persistence exploded");
  });
});
