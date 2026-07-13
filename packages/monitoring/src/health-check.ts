import { AI_MODULE_IDS, getConfig } from "@mkh/shared";
import { getRepository, type Repository } from "@mkh/database";
import { JobQueue } from "@mkh/queue";
import { NotificationQueue } from "@mkh/notifications";
import { getEmployee } from "@mkh/ai-engine";

export interface HealthCheckItem {
  name: string;
  ok: boolean;
  detail: string;
}

export interface HealthCheckResult {
  ok: boolean;
  checkedAt: string;
  items: HealthCheckItem[];
}

async function safeCheck(name: string, fn: () => Promise<string> | string): Promise<HealthCheckItem> {
  try {
    const detail = await fn();
    return { name, ok: true, detail };
  } catch (err) {
    return { name, ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * "Health Check" (Sprint 3B brief item #8) — verifies every infrastructure
 * surface the brief names, backend-only, read-only (no writes except the
 * Queue check, which enqueues and immediately claims+completes a
 * throwaway self-test job so it exercises the real claim path). Every
 * check is independent and wrapped so one failure doesn't prevent the
 * others from reporting — the caller gets a full picture, not just the
 * first failure.
 */
export async function runHealthCheck(repo: Repository = getRepository()): Promise<HealthCheckResult> {
  const items = await Promise.all([
    safeCheck("scheduler", async () => {
      const entries = await repo.listScheduleEntries();
      if (entries.length === 0) throw new Error("no schedule entries configured");
      return `${entries.length} schedule entries configured`;
    }),
    safeCheck("queue", async () => {
      const queue = new JobQueue(repo);
      const job = await queue.enqueue("health-check-self-test", { probe: true });
      const claimed = await queue.claimNext("health-check-self-test");
      if (!claimed || claimed.id !== job.id) throw new Error("enqueued self-test job could not be claimed");
      await queue.complete(claimed.id);
      return "enqueue/claim/complete round-trip succeeded";
    }),
    safeCheck("memory", async () => {
      const logs = await repo.listAIReasoningLogs({}, 1);
      return `reasoning-history readable (${logs.length} most-recent row(s) checked)`;
    }),
    safeCheck("knowledge", async () => {
      const items = await repo.listKnowledgeItems({}, 1);
      return `knowledge base readable (${items.length} most-recent item(s) checked)`;
    }),
    safeCheck("workers", () => {
      for (const moduleId of AI_MODULE_IDS) getEmployee(moduleId); // throws for an unregistered id
      return `${AI_MODULE_IDS.length} registered workers resolved`;
    }),
    safeCheck("notification_queue", async () => {
      const notificationQueue = new NotificationQueue(repo);
      const pending = await notificationQueue.countPending();
      return `notification queue readable (${pending} pending)`;
    }),
    safeCheck("persistence", async () => {
      await repo.getSalesSnapshot();
      await repo.getFinanceSnapshot();
      await repo.getHRSnapshot();
      return "core business-data fixtures readable";
    }),
    safeCheck("config", () => {
      const config = getConfig(); // throws (zod) if the environment fails validation
      return `config parsed for ${config.COMPANY_NAME}`;
    }),
    safeCheck("timezone", () => {
      const timezone = getConfig().COMPANY_TIMEZONE;
      new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date()); // throws RangeError for an invalid IANA zone
      return `"${timezone}" is a valid IANA timezone`;
    }),
  ]);

  return { ok: items.every((item) => item.ok), checkedAt: new Date().toISOString(), items };
}
