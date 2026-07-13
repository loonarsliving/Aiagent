import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "@mkh/database";
import { createConnectorRegistry } from "./registry";
import { computeWebhookSignature, WebhookEngine } from "./webhook-engine";

describe("WebhookEngine — signature validation", () => {
  it("accepts a payload with no secret configured (mock mode) even without a signature", async () => {
    const repo = new InMemoryRepository();
    const engine = new WebhookEngine(repo, createConnectorRegistry(repo));
    const result = await engine.receive({ connector: "whatsapp", rawPayload: { sender: "+62-812", text: "hi" } });
    expect(result.accepted).toBe(true);
  });

  it("rejects a payload when a secret is configured but no signature was provided", async () => {
    const repo = new InMemoryRepository();
    const engine = new WebhookEngine(repo, createConnectorRegistry(repo));
    const result = await engine.receive({ connector: "whatsapp", rawPayload: { sender: "+62-812", text: "hi" }, secret: "s3cret" });
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain("signature");
  });

  it("rejects a payload with a mismatched signature", async () => {
    const repo = new InMemoryRepository();
    const engine = new WebhookEngine(repo, createConnectorRegistry(repo));
    const result = await engine.receive({
      connector: "whatsapp",
      rawPayload: { sender: "+62-812", text: "hi" },
      secret: "s3cret",
      signature: "not-the-real-signature",
    });
    expect(result.accepted).toBe(false);
  });

  it("accepts a payload with a correctly computed signature", async () => {
    const repo = new InMemoryRepository();
    const engine = new WebhookEngine(repo, createConnectorRegistry(repo));
    const rawPayload = { sender: "+62-812", text: "hi" };
    const signature = computeWebhookSignature("s3cret", rawPayload);
    const result = await engine.receive({ connector: "whatsapp", rawPayload, secret: "s3cret", signature });
    expect(result.accepted).toBe(true);
  });
});

describe("WebhookEngine — parse/normalize/queue/log", () => {
  it("rejects and does not enqueue a payload the connector can't normalize", async () => {
    const repo = new InMemoryRepository();
    const engine = new WebhookEngine(repo, createConnectorRegistry(repo));
    const result = await engine.receive({ connector: "telegram", rawPayload: { garbage: true } });
    expect(result.accepted).toBe(false);
    expect(result.jobId).toBeUndefined();
  });

  it("logs the incoming request via the connector's own integration log regardless of accept/reject", async () => {
    const repo = new InMemoryRepository();
    const engine = new WebhookEngine(repo, createConnectorRegistry(repo));
    await engine.receive({ connector: "telegram", rawPayload: { garbage: true } });
    await engine.receive({ connector: "telegram", rawPayload: { sender: "chat-1", text: "hello" } });

    const logs = await repo.listIntegrationLogs({ connector: "telegram", direction: "incoming" });
    expect(logs).toHaveLength(2);
  });

  it("enqueues an accepted payload and claimNext returns it for processing", async () => {
    const repo = new InMemoryRepository();
    const engine = new WebhookEngine(repo, createConnectorRegistry(repo));
    const result = await engine.receive({ connector: "telegram", rawPayload: { sender: "chat-1", text: "hello" } });
    expect(result.accepted).toBe(true);
    expect(result.jobId).toBeTruthy();

    const claimed = await engine.claimNext();
    expect(claimed?.payload.connector).toBe("telegram");
    expect(claimed?.payload.normalized.sender).toBe("chat-1");
  });

  it("claimNext returns null when nothing is queued", async () => {
    const repo = new InMemoryRepository();
    const engine = new WebhookEngine(repo, createConnectorRegistry(repo));
    expect(await engine.claimNext()).toBeNull();
  });

  it("complete/fail let the consumer control the job's outcome after claiming", async () => {
    const repo = new InMemoryRepository();
    const engine = new WebhookEngine(repo, createConnectorRegistry(repo));
    await engine.receive({ connector: "telegram", rawPayload: { sender: "chat-1", text: "hello" } });

    const claimed = await engine.claimNext();
    await engine.complete(claimed!.jobId);

    const job = await repo.getJob(claimed!.jobId);
    expect(job?.status).toBe("success");
  });

  it("fail re-queues the job rather than losing it", async () => {
    const repo = new InMemoryRepository();
    const engine = new WebhookEngine(repo, createConnectorRegistry(repo));
    await engine.receive({ connector: "telegram", rawPayload: { sender: "chat-1", text: "hello" } });

    const claimed = await engine.claimNext();
    await engine.fail(claimed!.jobId, "processing exploded");

    const job = await repo.getJob(claimed!.jobId);
    expect(job?.status).toBe("pending");
    expect(job?.lastError).toBe("processing exploded");
  });
});
