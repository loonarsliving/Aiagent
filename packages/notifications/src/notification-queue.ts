import type { JobPriority, NotificationObject, QueueJob, ReasoningPriority } from "@mkh/shared";
import type { Repository } from "@mkh/database";
import { JobQueue, type EnqueueOptions } from "@mkh/queue";

/** The one job `type` discriminator every enqueued notification uses — see JobQueue's docs on why one generic queue backs every job kind. */
export const NOTIFICATION_JOB_TYPE = "notification-dispatch";

const PRIORITY_MAP: Record<ReasoningPriority, JobPriority> = { urgent: "urgent", high: "high", medium: "normal", low: "low" };

/**
 * "Notification Queue" (Sprint 3B, brief item #6) — a thin domain wrapper
 * over the generic Job Queue. It does exactly one thing: hold
 * `NotificationObject`s (Sprint 3A's governed notification payload,
 * `channel` always a placeholder — see docs/CONNECTORS.md) until something
 * later claims and dispatches them. **This class never sends anything —
 * there is no connector call anywhere in this file.** Delivery is Sprint 4+
 * scope; this sprint only builds the durable holding queue and the
 * claim/complete/fail lifecycle around it.
 */
export class NotificationQueue {
  private readonly queue: JobQueue;

  constructor(repo: Repository) {
    this.queue = new JobQueue(repo);
  }

  async enqueue(notification: NotificationObject, options: Omit<EnqueueOptions, "priority"> = {}): Promise<QueueJob<NotificationObject>> {
    return this.queue.enqueue(NOTIFICATION_JOB_TYPE, notification, {
      ...options,
      priority: PRIORITY_MAP[notification.priority],
    });
  }

  /** Claims the next due notification job (marks it "running") — does NOT deliver it. The caller decides what "processing" means, today that's nothing but bookkeeping. */
  async claimNext(): Promise<QueueJob<NotificationObject> | null> {
    return this.queue.claimNext(NOTIFICATION_JOB_TYPE) as Promise<QueueJob<NotificationObject> | null>;
  }

  async complete(jobId: string): Promise<QueueJob> {
    return this.queue.complete(jobId);
  }

  async fail(jobId: string, error: string): Promise<QueueJob> {
    return this.queue.fail(jobId, error);
  }

  async listDeadLetters(limit?: number): Promise<QueueJob[]> {
    return this.queue.listDeadLetters(NOTIFICATION_JOB_TYPE, limit);
  }

  async countPending(): Promise<number> {
    return this.queue.countByStatus("pending", NOTIFICATION_JOB_TYPE);
  }
}
