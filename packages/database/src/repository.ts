import type {
  AIModuleId,
  AIReasoningLogEntry,
  AIReport,
  ApprovalRequest,
  ApprovalStatus,
  ConversationLogEntry,
  JobStatus,
  NotificationMessage,
  QueueJob,
  ScheduleEntry,
  ScheduleRunRecord,
  SchedulerLock,
  TaskCadence,
  WorkLogEntry,
} from "@mkh/shared";
import type {
  FinanceSnapshot,
  HRSnapshot,
  KnowledgeItem,
  MarkomChecklistCompletionState,
  SalesSnapshot,
} from "./domain-types";

/**
 * Data-access boundary for the whole system. Two implementations exist:
 * InMemoryRepository (default, DATA_MODE=dummy) and SupabaseRepository
 * (DATA_MODE=supabase, schema in supabase/migrations). Every AI employee,
 * the scheduler, and the MCP server depend on this interface only — never
 * on a concrete implementation — so switching data modes is a one-line
 * change in `getRepository()`. This interface is deliberately "dumb
 * storage" only — business rules (approval RBAC, knowledge-item merging)
 * live one layer up, in @mkh/security and @mkh/memory respectively.
 */
export interface Repository {
  // Reports
  saveReport(report: AIReport): Promise<AIReport>;
  getLatestReport(moduleId: AIModuleId): Promise<AIReport | null>;
  listReports(moduleId?: AIModuleId, limit?: number): Promise<AIReport[]>;
  /** Most recent N daily reports for an employee, oldest first — the raw material for weekly/monthly aggregation. */
  listRecentReports(moduleId: AIModuleId, cadence: TaskCadence, limit: number): Promise<AIReport[]>;

  // Approvals (Meta Ads AI workflow: propose + decide, no execution yet)
  saveApproval(approval: ApprovalRequest): Promise<ApprovalRequest>;
  getApproval(id: string): Promise<ApprovalRequest | null>;
  listApprovals(status?: ApprovalStatus): Promise<ApprovalRequest[]>;
  updateApproval(approval: ApprovalRequest): Promise<ApprovalRequest>;

  // Notifications
  saveNotification(notification: NotificationMessage): Promise<NotificationMessage>;
  listNotifications(limit?: number): Promise<NotificationMessage[]>;

  // Scheduler
  listScheduleEntries(): Promise<ScheduleEntry[]>;
  saveScheduleRun(run: ScheduleRunRecord): Promise<ScheduleRunRecord>;
  updateScheduleRun(id: string, patch: Partial<ScheduleRunRecord>): Promise<ScheduleRunRecord>;
  listScheduleRuns(limit?: number): Promise<ScheduleRunRecord[]>;

  // Work log (granular SOP step trail — see @mkh/ai-engine's WorkLogger)
  logWorkStep(entry: WorkLogEntry): Promise<WorkLogEntry>;
  listWorkLog(filter: { moduleId?: AIModuleId; runId?: string }, limit?: number): Promise<WorkLogEntry[]>;

  // Knowledge base (every employee's own memory — see @mkh/memory)
  upsertKnowledgeItem(item: KnowledgeItem): Promise<KnowledgeItem>;
  listKnowledgeItems(filter: { moduleId?: AIModuleId; category?: string }, limit?: number): Promise<KnowledgeItem[]>;

  // AI reasoning audit log (Sprint 2 — one row per AIProvider call sequence;
  // see packages/ai-engine/src/reasoning/reasoning-engine.ts)
  saveAIReasoningLog(entry: AIReasoningLogEntry): Promise<AIReasoningLogEntry>;
  listAIReasoningLogs(filter: { moduleId?: AIModuleId; runId?: string }, limit?: number): Promise<AIReasoningLogEntry[]>;

  // Internal business-data fixtures consumed by employees
  getSalesSnapshot(): Promise<SalesSnapshot>;
  getFinanceSnapshot(): Promise<FinanceSnapshot>;
  getMarkomChecklistCompletionState(): Promise<MarkomChecklistCompletionState>;
  getHRSnapshot(): Promise<HRSnapshot>;

  // Job Queue (Sprint 3B — generic, durable async work; backs the Notification Queue and any future job type)
  enqueueJob(job: QueueJob): Promise<QueueJob>;
  getJob(id: string): Promise<QueueJob | null>;
  listJobs(filter: { status?: JobStatus; type?: string }, limit?: number): Promise<QueueJob[]>;
  updateJob(id: string, patch: Partial<QueueJob>): Promise<QueueJob>;
  /** Atomically claims (marks "running") the highest-priority, earliest-due pending job of the given type, or null if none is due. */
  claimNextPendingJob(type: string | undefined, now: string): Promise<QueueJob | null>;

  // Distributed Scheduler Lock (Sprint 3B — see packages/scheduler/src/distributed-lock.ts)
  /** Returns true if the lock was acquired (either free, or held by an expired holder), false if genuinely held by someone else. */
  acquireLock(lockKey: string, holderId: string, expiresAt: string): Promise<boolean>;
  /** No-ops if `holderId` doesn't currently hold the lock (e.g. it already expired and was reclaimed). */
  releaseLock(lockKey: string, holderId: string): Promise<void>;
  getLock(lockKey: string): Promise<SchedulerLock | null>;

  // Conversation log (Sprint 3B — the verbatim prompt/response exchange per reasoning call)
  saveConversationLog(entry: ConversationLogEntry): Promise<ConversationLogEntry>;
  listConversationLogs(filter: { moduleId?: AIModuleId; runId?: string }, limit?: number): Promise<ConversationLogEntry[]>;
}
