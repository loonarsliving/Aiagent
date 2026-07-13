import type { Repository } from "@mkh/database";
import { computeBackoffMs, generateId, getConfig, isPermanentFailure, type JobPriority, type JobStatus, type QueueJob } from "@mkh/shared";

export interface EnqueueOptions {
  priority?: JobPriority;
  /** ISO timestamp — defaults to "now" (immediately eligible). Set in the future for delayed jobs. */
  runAt?: string;
  /** Defaults to config.QUEUE_MAX_ATTEMPTS. */
  maxAttempts?: number;
}

/**
 * Generic durable async work queue (Sprint 3B). One mechanism backs every
 * job kind — `type` is the discriminator — rather than a bespoke table per
 * kind; the Notification Queue is a thin wrapper over this with
 * `type: "notification-dispatch"`. Concurrency/atomicity guarantees live in
 * `Repository.claimNextPendingJob` (see supabase-repository.ts for why the
 * job queue tolerates a weaker "best-effort" claim, unlike the scheduler
 * lock).
 */
export class JobQueue {
  constructor(private readonly repo: Repository) {}

  async enqueue<TPayload>(type: string, payload: TPayload, options: EnqueueOptions = {}): Promise<QueueJob<TPayload>> {
    const config = getConfig();
    const now = new Date().toISOString();
    const job: QueueJob<TPayload> = {
      id: generateId("job"),
      type,
      payload,
      priority: options.priority ?? "normal",
      status: "pending",
      runAt: options.runAt ?? now,
      attempts: 0,
      maxAttempts: options.maxAttempts ?? config.QUEUE_MAX_ATTEMPTS,
      createdAt: now,
      updatedAt: now,
    };
    return (await this.repo.enqueueJob(job as QueueJob)) as QueueJob<TPayload>;
  }

  /** Atomically claims the next due job of the given type (or any type), marking it "running". */
  async claimNext(type?: string): Promise<QueueJob | null> {
    return this.repo.claimNextPendingJob(type, new Date().toISOString());
  }

  async complete(jobId: string): Promise<QueueJob> {
    return this.repo.updateJob(jobId, { status: "success", updatedAt: new Date().toISOString() });
  }

  /**
   * Records a failed attempt. Re-queues with an exponential backoff delay
   * (`computeBackoffMs`) while attempts remain, or moves the job to the
   * Dead Letter Queue (`status: "dead"`) once `isPermanentFailure` says no
   * retries are left.
   */
  async fail(jobId: string, error: string): Promise<QueueJob> {
    const job = await this.repo.getJob(jobId);
    if (!job) throw new Error(`QueueJob ${jobId} not found`);

    const config = getConfig();
    const attempts = job.attempts + 1;
    const now = new Date().toISOString();

    if (isPermanentFailure(attempts - 1, job.maxAttempts)) {
      return this.repo.updateJob(jobId, { status: "dead", attempts, lastError: error, updatedAt: now });
    }

    const backoffMs = computeBackoffMs(config.QUEUE_RETRY_BACKOFF_MS, attempts - 1);
    return this.repo.updateJob(jobId, {
      status: "pending",
      attempts,
      lastError: error,
      runAt: new Date(Date.now() + backoffMs).toISOString(),
      updatedAt: now,
    });
  }

  async listDeadLetters(type?: string, limit?: number): Promise<QueueJob[]> {
    return this.repo.listJobs({ status: "dead", type }, limit);
  }

  async countByStatus(status: JobStatus, type?: string): Promise<number> {
    return (await this.repo.listJobs({ status, type }, Number.MAX_SAFE_INTEGER)).length;
  }
}
