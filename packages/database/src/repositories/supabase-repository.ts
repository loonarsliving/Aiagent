import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
import type { Repository } from "../repository";
import type {
  FinanceSnapshot,
  KnowledgeItem,
  MarkomChecklistCompletionState,
  SalesSnapshot,
} from "../domain-types";
import {
  DEFAULT_SCHEDULE,
  seedFinanceSnapshot,
  seedMarkomChecklistCompletionState,
  seedSalesSnapshot,
} from "../seed-data";

type Row = Record<string, unknown>;

/**
 * DATA_MODE=supabase implementation. Tables mirror supabase/migrations/.
 * Sales/finance/Markom-completion "source of truth" reads still fall back
 * to the same seed fixtures as InMemoryRepository until a real ERP sync
 * (via MK Connect) populates the equivalent Supabase tables — this keeps
 * employee logic identical across both data modes.
 */
export class SupabaseRepository implements Repository {
  private readonly client: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.client = createClient(url, serviceKey);
  }

  private async insert<T>(table: string, row: Row): Promise<T> {
    const { data, error } = await this.client.from(table).insert(row).select().single();
    if (error) throw new Error(`Supabase insert into ${table} failed: ${error.message}`);
    return data as T;
  }

  private async upsert<T>(table: string, row: Row, conflictKey: string): Promise<T> {
    const { data, error } = await this.client.from(table).upsert(row, { onConflict: conflictKey }).select().single();
    if (error) throw new Error(`Supabase upsert into ${table} failed: ${error.message}`);
    return data as T;
  }

  async saveReport(report: AIReport): Promise<AIReport> {
    await this.insert("reports", {
      id: report.id,
      module_id: report.moduleId,
      cadence: report.cadence,
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

  async listRecentReports(moduleId: AIModuleId, cadence: TaskCadence, limit: number): Promise<AIReport[]> {
    const { data, error } = await this.client
      .from("reports")
      .select("*")
      .eq("module_id", moduleId)
      .eq("cadence", cadence)
      .order("generated_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return (data ?? []).map(mapReportRow).reverse();
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
    return (data ?? []).map((row: Row) => ({
      id: row.id as string,
      channel: row.channel as NotificationMessage["channel"],
      severity: row.severity as NotificationMessage["severity"],
      title: row.title as string,
      body: row.body as string,
      target: (row.target as string | null) ?? undefined,
      sourceModuleId: (row.source_module_id as AIModuleId | null) ?? undefined,
      createdAt: row.created_at as string,
    }));
  }

  async listScheduleEntries(): Promise<ScheduleEntry[]> {
    const { data, error } = await this.client.from("schedule_entries").select("*");
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    if (!data || data.length === 0) return DEFAULT_SCHEDULE;
    return data.map((row: Row) => ({
      id: row.id as string,
      moduleId: row.module_id as AIModuleId,
      cadence: row.cadence as TaskCadence,
      time: row.time as string,
      dayOfWeek: (row.day_of_week as number | null) ?? undefined,
      dayOfMonth: (row.day_of_month as number | null) ?? undefined,
      label: row.label as string,
      enabled: row.enabled as boolean,
    }));
  }

  async saveScheduleRun(run: ScheduleRunRecord): Promise<ScheduleRunRecord> {
    await this.insert("schedule_runs", {
      id: run.id,
      module_id: run.moduleId,
      cadence: run.cadence,
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
    return mapScheduleRunRow(data);
  }

  async listScheduleRuns(limit = 50): Promise<ScheduleRunRecord[]> {
    const { data, error } = await this.client
      .from("schedule_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return (data ?? []).map(mapScheduleRunRow);
  }

  async logWorkStep(entry: WorkLogEntry): Promise<WorkLogEntry> {
    await this.insert("work_log", {
      id: entry.id,
      module_id: entry.moduleId,
      run_id: entry.runId,
      cadence: entry.cadence,
      step: entry.step,
      status: entry.status,
      detail: entry.detail ?? null,
      logged_at: entry.loggedAt,
    });
    return entry;
  }

  async listWorkLog(filter: { moduleId?: AIModuleId; runId?: string }, limit = 100): Promise<WorkLogEntry[]> {
    let query = this.client.from("work_log").select("*").order("logged_at", { ascending: false }).limit(limit);
    if (filter.moduleId) query = query.eq("module_id", filter.moduleId);
    if (filter.runId) query = query.eq("run_id", filter.runId);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return (data ?? []).map((row: Row) => ({
      id: row.id as string,
      moduleId: row.module_id as AIModuleId,
      runId: row.run_id as string,
      cadence: row.cadence as TaskCadence,
      step: row.step as string,
      status: row.status as WorkLogEntry["status"],
      detail: (row.detail as string | null) ?? undefined,
      loggedAt: row.logged_at as string,
    }));
  }

  async upsertKnowledgeItem(item: KnowledgeItem): Promise<KnowledgeItem> {
    await this.upsert(
      "knowledge_items",
      {
        id: item.id,
        module_id: item.moduleId,
        category: item.category,
        title: item.title,
        source_url: item.sourceUrl ?? null,
        first_seen_at: item.firstSeenAt,
        last_seen_at: item.lastSeenAt,
        times_seen: item.timesSeen,
        metadata: item.metadata,
      },
      "id",
    );
    return item;
  }

  async listKnowledgeItems(filter: { moduleId?: AIModuleId; category?: string }, limit = 200): Promise<KnowledgeItem[]> {
    let query = this.client.from("knowledge_items").select("*").order("last_seen_at", { ascending: false }).limit(limit);
    if (filter.moduleId) query = query.eq("module_id", filter.moduleId);
    if (filter.category) query = query.eq("category", filter.category);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return (data ?? []).map((row: Row) => ({
      id: row.id as string,
      moduleId: row.module_id as AIModuleId,
      category: row.category as string,
      title: row.title as string,
      sourceUrl: (row.source_url as string | null) ?? undefined,
      firstSeenAt: row.first_seen_at as string,
      lastSeenAt: row.last_seen_at as string,
      timesSeen: row.times_seen as number,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
    }));
  }

  // Sales/finance/checklist-completion tables are populated once a real ERP
  // sync exists; until then both data modes serve the same seed fixtures.
  async getSalesSnapshot(): Promise<SalesSnapshot> {
    return seedSalesSnapshot();
  }

  async getFinanceSnapshot(): Promise<FinanceSnapshot> {
    return seedFinanceSnapshot();
  }

  async getMarkomChecklistCompletionState(): Promise<MarkomChecklistCompletionState> {
    return seedMarkomChecklistCompletionState();
  }
}

function mapReportRow(row: Row): AIReport {
  return {
    id: row.id as string,
    moduleId: row.module_id as AIModuleId,
    cadence: row.cadence as TaskCadence,
    generatedAt: row.generated_at as string,
    status: row.status as AIReport["status"],
    summary: row.summary as string,
    data: row.data,
    error: (row.error as string | null) ?? undefined,
  };
}

function mapScheduleRunRow(row: Row): ScheduleRunRecord {
  return {
    id: row.id as string,
    moduleId: row.module_id as AIModuleId,
    cadence: row.cadence as TaskCadence,
    scheduledTime: row.scheduled_time as string,
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string | null) ?? undefined,
    status: row.status as ScheduleRunRecord["status"],
    reportId: (row.report_id as string | null) ?? undefined,
  };
}

function toApprovalRow(approval: ApprovalRequest): Row {
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

function mapApprovalRow(row: Row): ApprovalRequest {
  return {
    id: row.id as string,
    moduleId: row.module_id as AIModuleId,
    actionType: row.action_type as ApprovalRequest["actionType"],
    campaignId: row.campaign_id as string,
    campaignName: row.campaign_name as string,
    reason: row.reason as string,
    proposedChange: row.proposed_change as Record<string, unknown>,
    status: row.status as ApprovalStatus,
    requestedAt: row.requested_at as string,
    decidedAt: (row.decided_at as string | null) ?? undefined,
    decidedBy: (row.decided_by as string | null) ?? undefined,
  };
}
