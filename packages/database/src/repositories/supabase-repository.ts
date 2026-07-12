import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
 * DATA_MODE=supabase implementation. Tables mirror supabase/migrations/.
 * Sales/finance "source of truth" reads still fall back to the same seed
 * fixtures as InMemoryRepository until a real ERP sync (via MK Connect)
 * populates the equivalent Supabase tables — this keeps module logic
 * identical across both data modes.
 */
export class SupabaseRepository implements Repository {
  private readonly client: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.client = createClient(url, serviceKey);
  }

  private async insert<T>(table: string, row: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.client.from(table).insert(row).select().single();
    if (error) throw new Error(`Supabase insert into ${table} failed: ${error.message}`);
    return data as T;
  }

  async saveReport(report: AIReport): Promise<AIReport> {
    await this.insert("reports", {
      id: report.id,
      module_id: report.moduleId,
      generated_at: report.generatedAt,
      status: report.status,
      summary: report.summary,
      data: report.data,
      error: report.error ?? null,
    });
    return report;
  }

  async getLatestReport(moduleId: AIModuleId): Promise<AIReport | null> {
    const { data, error } = await this.client
      .from("reports")
      .select("*")
      .eq("module_id", moduleId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return data ? mapReportRow(data) : null;
  }

  async listReports(moduleId?: AIModuleId, limit = 50): Promise<AIReport[]> {
    let query = this.client.from("reports").select("*").order("generated_at", { ascending: false }).limit(limit);
    if (moduleId) query = query.eq("module_id", moduleId);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return (data ?? []).map(mapReportRow);
  }

  async saveApproval(approval: ApprovalRequest): Promise<ApprovalRequest> {
    await this.insert("approvals", toApprovalRow(approval));
    return approval;
  }

  async getApproval(id: string): Promise<ApprovalRequest | null> {
    const { data, error } = await this.client.from("approvals").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return data ? mapApprovalRow(data) : null;
  }

  async listApprovals(status?: ApprovalStatus): Promise<ApprovalRequest[]> {
    let query = this.client.from("approvals").select("*").order("requested_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return (data ?? []).map(mapApprovalRow);
  }

  async updateApproval(approval: ApprovalRequest): Promise<ApprovalRequest> {
    const { error } = await this.client.from("approvals").update(toApprovalRow(approval)).eq("id", approval.id);
    if (error) throw new Error(`Supabase update failed: ${error.message}`);
    return approval;
  }

  async saveActionLog(entry: ActionLogEntry): Promise<ActionLogEntry> {
    await this.insert("action_logs", {
      id: entry.id,
      approval_id: entry.approvalId,
      action_type: entry.actionType,
      campaign_id: entry.campaignId,
      executed_at: entry.executedAt,
      result: entry.result,
      detail: entry.detail,
    });
    return entry;
  }

  async listActionLogs(limit = 50): Promise<ActionLogEntry[]> {
    const { data, error } = await this.client
      .from("action_logs")
      .select("*")
      .order("executed_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return (data ?? []).map((row: Record<string, any>) => ({
      id: row.id,
      approvalId: row.approval_id,
      actionType: row.action_type,
      campaignId: row.campaign_id,
      executedAt: row.executed_at,
      result: row.result,
      detail: row.detail,
    }));
  }

  async saveNotification(notification: NotificationMessage): Promise<NotificationMessage> {
    await this.insert("notifications", {
      id: notification.id,
      channel: notification.channel,
      severity: notification.severity,
      title: notification.title,
      body: notification.body,
      target: notification.target ?? null,
      source_module_id: notification.sourceModuleId ?? null,
      created_at: notification.createdAt,
    });
    return notification;
  }

  async listNotifications(limit = 50): Promise<NotificationMessage[]> {
    const { data, error } = await this.client
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return (data ?? []).map((row: Record<string, any>) => ({
      id: row.id,
      channel: row.channel,
      severity: row.severity,
      title: row.title,
      body: row.body,
      target: row.target ?? undefined,
      sourceModuleId: row.source_module_id ?? undefined,
      createdAt: row.created_at,
    }));
  }

  async listScheduleEntries(): Promise<ScheduleEntry[]> {
    const { data, error } = await this.client.from("schedule_entries").select("*");
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    if (!data || data.length === 0) return DEFAULT_SCHEDULE;
    return data.map((row: Record<string, any>) => ({
      id: row.id,
      moduleId: row.module_id,
      time: row.time,
      label: row.label,
      enabled: row.enabled,
    }));
  }

  async saveScheduleRun(run: ScheduleRunRecord): Promise<ScheduleRunRecord> {
    await this.insert("schedule_runs", {
      id: run.id,
      module_id: run.moduleId,
      scheduled_time: run.scheduledTime,
      started_at: run.startedAt,
      finished_at: run.finishedAt ?? null,
      status: run.status,
      report_id: run.reportId ?? null,
    });
    return run;
  }

  async updateScheduleRun(id: string, patch: Partial<ScheduleRunRecord>): Promise<ScheduleRunRecord> {
    const { data, error } = await this.client
      .from("schedule_runs")
      .update({
        finished_at: patch.finishedAt ?? undefined,
        status: patch.status ?? undefined,
        report_id: patch.reportId ?? undefined,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`Supabase update failed: ${error.message}`);
    return {
      id: data.id,
      moduleId: data.module_id,
      scheduledTime: data.scheduled_time,
      startedAt: data.started_at,
      finishedAt: data.finished_at ?? undefined,
      status: data.status,
      reportId: data.report_id ?? undefined,
    };
  }

  async listScheduleRuns(limit = 50): Promise<ScheduleRunRecord[]> {
    const { data, error } = await this.client
      .from("schedule_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return (data ?? []).map((row: Record<string, any>) => ({
      id: row.id,
      moduleId: row.module_id,
      scheduledTime: row.scheduled_time,
      startedAt: row.started_at,
      finishedAt: row.finished_at ?? undefined,
      status: row.status,
      reportId: row.report_id ?? undefined,
    }));
  }

  // Sales/finance tables are populated once a real ERP sync exists; until
  // then both data modes serve the same seed fixtures.
  async getSalesSnapshot(): Promise<SalesSnapshot> {
    return seedSalesSnapshot();
  }

  async getFinanceSnapshot(): Promise<FinanceSnapshot> {
    return seedFinanceSnapshot();
  }
}

function mapReportRow(row: Record<string, any>): AIReport {
  return {
    id: row.id,
    moduleId: row.module_id,
    generatedAt: row.generated_at,
    status: row.status,
    summary: row.summary,
    data: row.data,
    error: row.error ?? undefined,
  };
}

function toApprovalRow(approval: ApprovalRequest) {
  return {
    id: approval.id,
    module_id: approval.moduleId,
    action_type: approval.actionType,
    campaign_id: approval.campaignId,
    campaign_name: approval.campaignName,
    reason: approval.reason,
    proposed_change: approval.proposedChange,
    status: approval.status,
    requested_at: approval.requestedAt,
    decided_at: approval.decidedAt ?? null,
    decided_by: approval.decidedBy ?? null,
  };
}

function mapApprovalRow(row: Record<string, any>): ApprovalRequest {
  return {
    id: row.id,
    moduleId: row.module_id,
    actionType: row.action_type,
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    reason: row.reason,
    proposedChange: row.proposed_change,
    status: row.status,
    requestedAt: row.requested_at,
    decidedAt: row.decided_at ?? undefined,
    decidedBy: row.decided_by ?? undefined,
  };
}
