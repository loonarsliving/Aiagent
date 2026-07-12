import type {
  ActionLogEntry,
  AIModuleId,
  AIReport,
  ApprovalRequest,
  ApprovalStatus,
  NotificationMessage,
  ScheduleEntry,
  ScheduleRunRecord,
} from "@mkh/shared";
import type { FinanceSnapshot, SalesSnapshot } from "./domain-types";

/**
 * Data-access boundary for the whole system. Two implementations exist:
 * InMemoryRepository (default, DATA_MODE=dummy) and SupabaseRepository
 * (DATA_MODE=supabase, schema in supabase/migrations). Every AI module,
 * the dashboard, and the MCP server depend on this interface only — never
 * on a concrete implementation — so switching data modes is a one-line
 * change in `getRepository()`.
 */
export interface Repository {
  // Reports
  saveReport(report: AIReport): Promise<AIReport>;
  getLatestReport(moduleId: AIModuleId): Promise<AIReport | null>;
  listReports(moduleId?: AIModuleId, limit?: number): Promise<AIReport[]>;

  // Approvals (Meta Ads Stage 2)
  saveApproval(approval: ApprovalRequest): Promise<ApprovalRequest>;
  getApproval(id: string): Promise<ApprovalRequest | null>;
  listApprovals(status?: ApprovalStatus): Promise<ApprovalRequest[]>;
  updateApproval(approval: ApprovalRequest): Promise<ApprovalRequest>;

  // Action logs
  saveActionLog(entry: ActionLogEntry): Promise<ActionLogEntry>;
  listActionLogs(limit?: number): Promise<ActionLogEntry[]>;

  // Notifications
  saveNotification(notification: NotificationMessage): Promise<NotificationMessage>;
  listNotifications(limit?: number): Promise<NotificationMessage[]>;

  // Scheduler
  listScheduleEntries(): Promise<ScheduleEntry[]>;
  saveScheduleRun(run: ScheduleRunRecord): Promise<ScheduleRunRecord>;
  updateScheduleRun(id: string, patch: Partial<ScheduleRunRecord>): Promise<ScheduleRunRecord>;
  listScheduleRuns(limit?: number): Promise<ScheduleRunRecord[]>;

  // Internal business-data fixtures consumed by Sales/Finance modules
  getSalesSnapshot(): Promise<SalesSnapshot>;
  getFinanceSnapshot(): Promise<FinanceSnapshot>;
}
