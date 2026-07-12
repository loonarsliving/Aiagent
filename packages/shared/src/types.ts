export const AI_MODULE_IDS = [
  "marketing-strategist",
  "meta-ads-operator",
  "sales-supervisor",
  "finance-analyst",
  "ceo-assistant",
] as const;

export type AIModuleId = (typeof AI_MODULE_IDS)[number];

export type AIRunStatus = "success" | "error";

export interface AIRunContext {
  /** What kicked this run off — a scheduler slot, a manual dashboard trigger, or another module (e.g. ceo-assistant). */
  triggeredBy: "scheduler" | "manual" | "module";
  /** ISO timestamp; defaults to "now" if omitted by the caller. */
  runAt?: string;
}

/**
 * The standard envelope every AI module returns. `data` is module-specific
 * and typed by each module; `summary` is what shows up in logs/dashboard
 * lists and in the CEO Assistant's rollup.
 */
export interface AIReport<TData = unknown> {
  id: string;
  moduleId: AIModuleId;
  generatedAt: string;
  status: AIRunStatus;
  summary: string;
  data: TData;
  /** Populated only when status === "error". */
  error?: string;
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type MetaAdsActionType =
  | "increase_budget"
  | "decrease_budget"
  | "pause_campaign"
  | "activate_campaign";

export interface ApprovalRequest {
  id: string;
  moduleId: AIModuleId;
  actionType: MetaAdsActionType;
  campaignId: string;
  campaignName: string;
  reason: string;
  proposedChange: Record<string, unknown>;
  status: ApprovalStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface ActionLogEntry {
  id: string;
  approvalId: string;
  actionType: MetaAdsActionType;
  campaignId: string;
  executedAt: string;
  result: "executed" | "failed";
  detail: string;
}

export type NotificationChannelType =
  | "dummy"
  | "whatsapp"
  | "telegram"
  | "email"
  | "push";

export type NotificationSeverity = "info" | "warning" | "critical";

export interface NotificationMessage {
  id: string;
  channel: NotificationChannelType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  target?: string;
  sourceModuleId?: AIModuleId;
  createdAt: string;
}

export interface ScheduleEntry {
  id: string;
  moduleId: AIModuleId;
  /** 24h "HH:mm", local to the company timezone (Asia/Makassar). */
  time: string;
  label: string;
  enabled: boolean;
}

export interface ScheduleRunRecord {
  id: string;
  moduleId: AIModuleId;
  scheduledTime: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "success" | "error";
  reportId?: string;
}
