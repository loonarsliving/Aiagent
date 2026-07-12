import type {
  AIModuleId,
  AIReport,
  ApprovalRequest,
  ApprovalStatus,
  NotificationMessage,
  ScheduleEntry,
  ScheduleRunRecord,
  TaskCadence,
  WorkLogEntry,
} from "@mkh/shared";
import type {
  FinanceSnapshot,
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

  // Knowledge base (Marketing Intelligence's memory — see @mkh/memory)
  upsertKnowledgeItem(item: KnowledgeItem): Promise<KnowledgeItem>;
  listKnowledgeItems(filter: { moduleId?: AIModuleId; category?: string }, limit?: number): Promise<KnowledgeItem[]>;

  // Internal business-data fixtures consumed by employees
  getSalesSnapshot(): Promise<SalesSnapshot>;
  getFinanceSnapshot(): Promise<FinanceSnapshot>;
  getMarkomChecklistCompletionState(): Promise<MarkomChecklistCompletionState>;
}
