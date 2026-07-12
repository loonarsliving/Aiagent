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
import type { Repository } from "../repository";
import type { FinanceSnapshot, SalesSnapshot } from "../domain-types";
import { DEFAULT_SCHEDULE, seedFinanceSnapshot, seedSalesSnapshot } from "../seed-data";

/**
 * Default repository (DATA_MODE=dummy). Holds everything in process memory,
 * seeded with realistic fixtures on construction. Nothing here persists
 * across restarts — that's intentional for a "safe to run anywhere" MVP.
 */
export class InMemoryRepository implements Repository {
  private reports: AIReport[] = [];
  private approvals: ApprovalRequest[] = [];
  private actionLogs: ActionLogEntry[] = [];
  private notifications: NotificationMessage[] = [];
  private scheduleRuns: ScheduleRunRecord[] = [];
  private readonly schedule: ScheduleEntry[] = DEFAULT_SCHEDULE;
  private readonly salesSnapshot: SalesSnapshot = seedSalesSnapshot();
  private readonly financeSnapshot: FinanceSnapshot = seedFinanceSnapshot();

  async saveReport(report: AIReport): Promise<AIReport> {
    this.reports.unshift(report);
    return report;
  }

  async getLatestReport(moduleId: AIModuleId): Promise<AIReport | null> {
    return this.reports.find((r) => r.moduleId === moduleId) ?? null;
  }

  async listReports(moduleId?: AIModuleId, limit = 50): Promise<AIReport[]> {
    const filtered = moduleId ? this.reports.filter((r) => r.moduleId === moduleId) : this.reports;
    return filtered.slice(0, limit);
  }

  async saveApproval(approval: ApprovalRequest): Promise<ApprovalRequest> {
    this.approvals.unshift(approval);
    return approval;
  }

  async getApproval(id: string): Promise<ApprovalRequest | null> {
    return this.approvals.find((a) => a.id === id) ?? null;
  }

  async listApprovals(status?: ApprovalStatus): Promise<ApprovalRequest[]> {
    return status ? this.approvals.filter((a) => a.status === status) : this.approvals;
  }

  /** Called after decideApproval() to persist the updated status in place. */
  async updateApproval(approval: ApprovalRequest): Promise<ApprovalRequest> {
    const idx = this.approvals.findIndex((a) => a.id === approval.id);
    if (idx === -1) {
      this.approvals.unshift(approval);
    } else {
      this.approvals[idx] = approval;
    }
    return approval;
  }

  async saveActionLog(entry: ActionLogEntry): Promise<ActionLogEntry> {
    this.actionLogs.unshift(entry);
    return entry;
  }

  async listActionLogs(limit = 50): Promise<ActionLogEntry[]> {
    return this.actionLogs.slice(0, limit);
  }

  async saveNotification(notification: NotificationMessage): Promise<NotificationMessage> {
    this.notifications.unshift(notification);
    return notification;
  }

  async listNotifications(limit = 50): Promise<NotificationMessage[]> {
    return this.notifications.slice(0, limit);
  }

  async listScheduleEntries(): Promise<ScheduleEntry[]> {
    return this.schedule;
  }

  async saveScheduleRun(run: ScheduleRunRecord): Promise<ScheduleRunRecord> {
    this.scheduleRuns.unshift(run);
    return run;
  }

  async updateScheduleRun(id: string, patch: Partial<ScheduleRunRecord>): Promise<ScheduleRunRecord> {
    const idx = this.scheduleRuns.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`ScheduleRunRecord ${id} not found`);
    const existing = this.scheduleRuns[idx]!;
    const updated = { ...existing, ...patch };
    this.scheduleRuns[idx] = updated;
    return updated;
  }

  async listScheduleRuns(limit = 50): Promise<ScheduleRunRecord[]> {
    return this.scheduleRuns.slice(0, limit);
  }

  async getSalesSnapshot(): Promise<SalesSnapshot> {
    return this.salesSnapshot;
  }

  async getFinanceSnapshot(): Promise<FinanceSnapshot> {
    return this.financeSnapshot;
  }
}
