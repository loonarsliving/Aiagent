import { AI_MODULE_IDS, isSameCompanyDay, type AIModuleId, type AIRunStatus, type JobStatus, type TaskCadence } from "@mkh/shared";
import { getRepository, type Repository } from "@mkh/database";
import { NOTIFICATION_JOB_TYPE } from "@mkh/notifications";

export interface WorkerStatus {
  moduleId: AIModuleId;
  lastRunAt: string | null;
  lastStatus: AIRunStatus | null;
  lastCadence: TaskCadence | null;
}

export interface QueueHealth {
  pending: number;
  running: number;
  success: number;
  failed: number;
  dead: number;
  /** Pending jobs that have already failed at least once and are waiting out a backoff delay before their next attempt. */
  retrying: number;
}

export interface SchedulerHeartbeat {
  lastRunAt: string | null;
  lastRunStatus: "running" | "success" | "error" | "skipped" | null;
  /** ms since the last scheduler run started, or null if the scheduler has never run. */
  msSinceLastRun: number | null;
}

export interface ReasoningStats {
  /** Reasoning attempts (AIReasoningLogEntry rows) logged today, in the company's timezone. */
  executionsToday: number;
  averageResponseTimeMs: number;
  totalTokensToday: number;
}

export interface MonitoringSnapshot {
  generatedAt: string;
  workers: WorkerStatus[];
  queue: QueueHealth;
  notificationQueue: QueueHealth;
  scheduler: SchedulerHeartbeat;
  reasoning: ReasoningStats;
  memoryUsage: NodeJS.MemoryUsage;
}

async function queueHealthFor(repo: Repository, type?: string): Promise<QueueHealth> {
  const statuses: JobStatus[] = ["pending", "running", "success", "failed", "dead"];
  const counts = await Promise.all(statuses.map((status) => repo.listJobs({ status, type }, Number.MAX_SAFE_INTEGER)));
  const [pending, running, success, failed, dead] = counts.map((jobs) => jobs.length);
  const retrying = counts[0]!.filter((job) => job.attempts > 0).length;
  return { pending: pending!, running: running!, success: success!, failed: failed!, dead: dead!, retrying };
}

async function workerStatuses(repo: Repository): Promise<WorkerStatus[]> {
  return Promise.all(
    AI_MODULE_IDS.map(async (moduleId) => {
      const report = await repo.getLatestReport(moduleId);
      return {
        moduleId,
        lastRunAt: report?.generatedAt ?? null,
        lastStatus: report?.status ?? null,
        lastCadence: report?.cadence ?? null,
      };
    }),
  );
}

async function schedulerHeartbeat(repo: Repository): Promise<SchedulerHeartbeat> {
  const [latest] = await repo.listScheduleRuns(1);
  if (!latest) return { lastRunAt: null, lastRunStatus: null, msSinceLastRun: null };
  return {
    lastRunAt: latest.startedAt,
    lastRunStatus: latest.status,
    msSinceLastRun: Date.now() - new Date(latest.startedAt).getTime(),
  };
}

async function reasoningStats(repo: Repository): Promise<ReasoningStats> {
  const logs = await repo.listAIReasoningLogs({}, Number.MAX_SAFE_INTEGER);
  const today = logs.filter((log) => isSameCompanyDay(log.createdAt, new Date()));
  const totalResponseTimeMs = today.reduce((sum, log) => sum + log.responseTimeMs, 0);
  const totalTokensToday = today.reduce((sum, log) => sum + (log.totalTokens ?? 0), 0);
  return {
    executionsToday: today.length,
    averageResponseTimeMs: today.length > 0 ? Math.round(totalResponseTimeMs / today.length) : 0,
    totalTokensToday,
  };
}

/**
 * "AI Monitoring" (Sprint 3B brief item #7) — backend-only aggregation over
 * everything the Persistence Layer already records. No new storage, no UI:
 * this just reads across Repository/JobQueue and shapes the numbers a
 * future dashboard or alerting job would want. Every field maps directly to
 * a brief bullet: workers (worker status), queue (queue length/failed
 * jobs/retry count), scheduler (heartbeat), reasoning (average reasoning
 * time/token usage/daily execution count), memoryUsage (memory usage).
 */
export async function getMonitoringSnapshot(repo: Repository = getRepository()): Promise<MonitoringSnapshot> {
  const [workers, queue, notificationQueue, scheduler, reasoning] = await Promise.all([
    workerStatuses(repo),
    queueHealthFor(repo),
    queueHealthFor(repo, NOTIFICATION_JOB_TYPE),
    schedulerHeartbeat(repo),
    reasoningStats(repo),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    workers,
    queue,
    notificationQueue,
    scheduler,
    reasoning,
    memoryUsage: process.memoryUsage(),
  };
}
