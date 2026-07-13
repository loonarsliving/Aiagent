import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AIModuleId,
  AIReasoningLogEntry,
  AIReport,
  ApprovalRequest,
  ApprovalStatus,
  ChatConversation,
  ChatConversationStatus,
  ChatMessage,
  ConnectorType,
  ConversationLogEntry,
  IntegrationDirection,
  IntegrationLogEntry,
  JobPriority,
  JobStatus,
  NotificationMessage,
  QueueJob,
  ScheduleEntry,
  ScheduleRunRecord,
  SchedulerLock,
  TaskCadence,
  WorkLogEntry,
} from "@mkh/shared";
import type { Repository } from "../repository";
import { PRIORITY_RANK } from "../priority-rank";
import type {
  FinanceSnapshot,
  HRSnapshot,
  KnowledgeItem,
  MarkomChecklistCompletionState,
  SalesSnapshot,
} from "../domain-types";
import {
  DEFAULT_SCHEDULE,
  seedFinanceSnapshot,
  seedHRSnapshot,
  seedMarkomChecklistCompletionState,
  seedSalesSnapshot,
} from "../seed-data";

export type Row = Record<string, unknown>;

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
      duration_ms: report.durationMs ?? null,
      retry_count: report.retryCount ?? null,
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
      attempt: entry.attempt ?? null,
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
      attempt: (row.attempt as number | null) ?? undefined,
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

  async getHRSnapshot(): Promise<HRSnapshot> {
    return seedHRSnapshot();
  }

  async saveAIReasoningLog(entry: AIReasoningLogEntry): Promise<AIReasoningLogEntry> {
    await this.insert("ai_reasoning_logs", {
      id: entry.id,
      module_id: entry.moduleId,
      run_id: entry.runId,
      provider: entry.provider,
      model: entry.model,
      status: entry.status,
      response_time_ms: entry.responseTimeMs,
      prompt_tokens: entry.promptTokens ?? null,
      completion_tokens: entry.completionTokens ?? null,
      total_tokens: entry.totalTokens ?? null,
      retry_count: entry.retryCount,
      error_reason: entry.errorReason ?? null,
      created_at: entry.createdAt,
    });
    return entry;
  }

  async listAIReasoningLogs(filter: { moduleId?: AIModuleId; runId?: string }, limit = 100): Promise<AIReasoningLogEntry[]> {
    let query = this.client.from("ai_reasoning_logs").select("*").order("created_at", { ascending: false }).limit(limit);
    if (filter.moduleId) query = query.eq("module_id", filter.moduleId);
    if (filter.runId) query = query.eq("run_id", filter.runId);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return (data ?? []).map(mapAIReasoningLogRow);
  }

  async enqueueJob(job: QueueJob): Promise<QueueJob> {
    await this.insert("jobs", toJobRow(job));
    return job;
  }

  async getJob(id: string): Promise<QueueJob | null> {
    const { data, error } = await this.client.from("jobs").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return data ? mapJobRow(data) : null;
  }

  async listJobs(filter: { status?: JobStatus; type?: string }, limit = 100): Promise<QueueJob[]> {
    let query = this.client.from("jobs").select("*").order("created_at", { ascending: false }).limit(limit);
    if (filter.status) query = query.eq("status", filter.status);
    if (filter.type) query = query.eq("type", filter.type);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return (data ?? []).map(mapJobRow);
  }

  async updateJob(id: string, patch: Partial<QueueJob>): Promise<QueueJob> {
    const { data, error } = await this.client
      .from("jobs")
      .update({
        status: patch.status ?? undefined,
        priority: patch.priority ?? undefined,
        priority_rank: patch.priority ? PRIORITY_RANK[patch.priority] : undefined,
        run_at: patch.runAt ?? undefined,
        attempts: patch.attempts ?? undefined,
        last_error: patch.lastError ?? undefined,
        updated_at: patch.updatedAt ?? undefined,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`Supabase update failed: ${error.message}`);
    return mapJobRow(data);
  }

  /**
   * Best-effort claim: selects the top candidate client-side, then updates
   * it conditionally on status still being "pending" so a losing
   * concurrent claim affects 0 rows rather than double-claiming. Weaker
   * than a `FOR UPDATE SKIP LOCKED` stored procedure (worth adding once
   * job volume justifies the ops cost of a dedicated Postgres function) —
   * unlike the scheduler lock below, a job being claimed twice is a
   * tolerable, low-stakes race (worst case: a job runs twice), so the
   * lighter-weight approach is a deliberate trade-off here.
   */
  async claimNextPendingJob(type: string | undefined, now: string): Promise<QueueJob | null> {
    let query = this.client
      .from("jobs")
      .select("*")
      .eq("status", "pending")
      .lte("run_at", now)
      .order("priority_rank", { ascending: true })
      .order("run_at", { ascending: true })
      .limit(1);
    if (type) query = query.eq("type", type);
    const { data: candidate, error } = await query.maybeSingle();
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    if (!candidate) return null;

    const { data: claimed, error: updateError } = await this.client
      .from("jobs")
      .update({ status: "running", updated_at: now })
      .eq("id", candidate.id as string)
      .eq("status", "pending")
      .select()
      .maybeSingle();
    if (updateError) throw new Error(`Supabase update failed: ${updateError.message}`);
    return claimed ? mapJobRow(claimed) : null;
  }

  /**
   * Atomic — backed by the `acquire_scheduler_lock` Postgres function
   * (supabase/migrations), not a check-then-write from this client. This
   * is the one Sprint 3B primitive where a race condition would have a
   * genuinely bad outcome (two processes both believing they alone should
   * run an employee), so it gets the stronger guarantee; see
   * `claimNextPendingJob` above for why the job queue doesn't need the
   * same treatment.
   */
  async acquireLock(lockKey: string, holderId: string, expiresAt: string): Promise<boolean> {
    const { data, error } = await this.client.rpc("acquire_scheduler_lock", {
      p_lock_key: lockKey,
      p_holder_id: holderId,
      p_expires_at: expiresAt,
    });
    if (error) throw new Error(`Supabase RPC acquire_scheduler_lock failed: ${error.message}`);
    return Boolean(data);
  }

  async releaseLock(lockKey: string, holderId: string): Promise<void> {
    const { error } = await this.client.from("scheduler_locks").delete().eq("lock_key", lockKey).eq("holder_id", holderId);
    if (error) throw new Error(`Supabase delete failed: ${error.message}`);
  }

  async getLock(lockKey: string): Promise<SchedulerLock | null> {
    const { data, error } = await this.client.from("scheduler_locks").select("*").eq("lock_key", lockKey).maybeSingle();
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return data ? mapSchedulerLockRow(data) : null;
  }

  async saveConversationLog(entry: ConversationLogEntry): Promise<ConversationLogEntry> {
    await this.insert("conversation_logs", {
      id: entry.id,
      module_id: entry.moduleId,
      run_id: entry.runId,
      system_prompt: entry.systemPrompt,
      user_prompt: entry.userPrompt,
      response_text: entry.responseText,
      created_at: entry.createdAt,
    });
    return entry;
  }

  async listConversationLogs(filter: { moduleId?: AIModuleId; runId?: string }, limit = 50): Promise<ConversationLogEntry[]> {
    let query = this.client.from("conversation_logs").select("*").order("created_at", { ascending: false }).limit(limit);
    if (filter.moduleId) query = query.eq("module_id", filter.moduleId);
    if (filter.runId) query = query.eq("run_id", filter.runId);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return (data ?? []).map(mapConversationLogRow);
  }

  async saveIntegrationLog(entry: IntegrationLogEntry): Promise<IntegrationLogEntry> {
    await this.insert("integration_logs", {
      id: entry.id,
      connector: entry.connector,
      direction: entry.direction,
      payload: entry.payload,
      status: entry.status,
      response_status: entry.responseStatus ?? null,
      error: entry.error ?? null,
      created_at: entry.createdAt,
    });
    return entry;
  }

  async listIntegrationLogs(
    filter: { connector?: ConnectorType; direction?: IntegrationDirection; status?: IntegrationLogEntry["status"] },
    limit = 100,
  ): Promise<IntegrationLogEntry[]> {
    let query = this.client.from("integration_logs").select("*").order("created_at", { ascending: false }).limit(limit);
    if (filter.connector) query = query.eq("connector", filter.connector);
    if (filter.direction) query = query.eq("direction", filter.direction);
    if (filter.status) query = query.eq("status", filter.status);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return (data ?? []).map(mapIntegrationLogRow);
  }

  async saveConversation(conversation: ChatConversation): Promise<ChatConversation> {
    await this.upsert(
      "chat_conversations",
      {
        id: conversation.id,
        connector: conversation.connector,
        sender: conversation.sender,
        intent: conversation.intent,
        assigned_agent: conversation.assignedAgent,
        status: conversation.status,
        history: conversation.history,
        created_at: conversation.createdAt,
        updated_at: conversation.updatedAt,
      },
      "id",
    );
    return conversation;
  }

  async getConversation(id: string): Promise<ChatConversation | null> {
    const { data, error } = await this.client.from("chat_conversations").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return data ? mapChatConversationRow(data) : null;
  }

  async listConversations(
    filter: { connector?: ConnectorType; status?: ChatConversationStatus; assignedAgent?: AIModuleId },
    limit = 50,
  ): Promise<ChatConversation[]> {
    let query = this.client.from("chat_conversations").select("*").order("updated_at", { ascending: false }).limit(limit);
    if (filter.connector) query = query.eq("connector", filter.connector);
    if (filter.status) query = query.eq("status", filter.status);
    if (filter.assignedAgent) query = query.eq("assigned_agent", filter.assignedAgent);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return (data ?? []).map(mapChatConversationRow);
  }
}

function toJobRow(job: QueueJob): Row {
  return {
    id: job.id,
    type: job.type,
    payload: job.payload,
    priority: job.priority,
    priority_rank: PRIORITY_RANK[job.priority],
    status: job.status,
    run_at: job.runAt,
    attempts: job.attempts,
    max_attempts: job.maxAttempts,
    last_error: job.lastError ?? null,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  };
}

export function mapJobRow(row: Row): QueueJob {
  return {
    id: row.id as string,
    type: row.type as string,
    payload: row.payload,
    priority: row.priority as JobPriority,
    status: row.status as JobStatus,
    runAt: row.run_at as string,
    attempts: row.attempts as number,
    maxAttempts: row.max_attempts as number,
    lastError: (row.last_error as string | null) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapSchedulerLockRow(row: Row): SchedulerLock {
  return {
    lockKey: row.lock_key as string,
    holderId: row.holder_id as string,
    acquiredAt: row.acquired_at as string,
    expiresAt: row.expires_at as string,
  };
}

export function mapConversationLogRow(row: Row): ConversationLogEntry {
  return {
    id: row.id as string,
    moduleId: row.module_id as AIModuleId,
    runId: row.run_id as string,
    systemPrompt: row.system_prompt as string,
    userPrompt: row.user_prompt as string,
    responseText: row.response_text as string,
    createdAt: row.created_at as string,
  };
}

export function mapIntegrationLogRow(row: Row): IntegrationLogEntry {
  return {
    id: row.id as string,
    connector: row.connector as ConnectorType,
    direction: row.direction as IntegrationDirection,
    payload: row.payload,
    status: row.status as IntegrationLogEntry["status"],
    responseStatus: (row.response_status as number | null) ?? undefined,
    error: (row.error as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export function mapChatConversationRow(row: Row): ChatConversation {
  return {
    id: row.id as string,
    connector: row.connector as ConnectorType,
    sender: row.sender as string,
    intent: (row.intent as string | null) ?? null,
    assignedAgent: (row.assigned_agent as AIModuleId | null) ?? null,
    status: row.status as ChatConversationStatus,
    history: (row.history as ChatMessage[] | null) ?? [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapAIReasoningLogRow(row: Row): AIReasoningLogEntry {
  return {
    id: row.id as string,
    moduleId: row.module_id as AIModuleId,
    runId: row.run_id as string,
    provider: row.provider as AIReasoningLogEntry["provider"],
    model: row.model as string,
    status: row.status as AIReasoningLogEntry["status"],
    responseTimeMs: row.response_time_ms as number,
    promptTokens: (row.prompt_tokens as number | null) ?? undefined,
    completionTokens: (row.completion_tokens as number | null) ?? undefined,
    totalTokens: (row.total_tokens as number | null) ?? undefined,
    retryCount: row.retry_count as number,
    errorReason: (row.error_reason as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export function mapReportRow(row: Row): AIReport {
  return {
    id: row.id as string,
    moduleId: row.module_id as AIModuleId,
    cadence: row.cadence as TaskCadence,
    generatedAt: row.generated_at as string,
    status: row.status as AIReport["status"],
    summary: row.summary as string,
    data: row.data,
    error: (row.error as string | null) ?? undefined,
    durationMs: (row.duration_ms as number | null) ?? undefined,
    retryCount: (row.retry_count as number | null) ?? undefined,
  };
}

export function mapScheduleRunRow(row: Row): ScheduleRunRecord {
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

export function toApprovalRow(approval: ApprovalRequest): Row {
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

export function mapApprovalRow(row: Row): ApprovalRequest {
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
