/**
 * The six digital employees. Marketing is split into Intelligence (research/
 * knowledge-base, no design output) and Operation (reads Intelligence's
 * report, owns the Markom checklist/reminders) per the workforce redesign.
 */
export const AI_MODULE_IDS = [
  "marketing-intelligence",
  "marketing-operation",
  "meta-ads-operator",
  "sales-supervisor",
  "finance-analyst",
  "ceo-assistant",
] as const;

export type AIModuleId = (typeof AI_MODULE_IDS)[number];

export type AIRunStatus = "success" | "error";

export interface AIRunContext {
  /** What kicked this run off — a scheduler slot, a manual/script trigger, or another employee (e.g. ceo-assistant reading others). */
  triggeredBy: "scheduler" | "manual" | "module";
  /** ISO timestamp; defaults to "now" if omitted by the caller. */
  runAt?: string;
}

/**
 * The standard envelope every AI employee's task returns. `data` is
 * task-specific and typed by each employee; `summary` is what shows up in
 * logs and in the CEO Assistant's rollup.
 */
export interface AIReport<TData = unknown> {
  id: string;
  moduleId: AIModuleId;
  cadence: TaskCadence;
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

/**
 * The output of Meta Ads AI's workflow: a proposed action awaiting Owner
 * decision via MK Connect. Execution against a real ad account is a
 * separate, not-yet-built phase — this type only covers propose/decide.
 */
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

/** Every employee works on one or more of these cadences — see EmployeeSOP. */
export type TaskCadence = "daily" | "weekly" | "monthly";

export interface ScheduleEntry {
  id: string;
  moduleId: AIModuleId;
  cadence: TaskCadence;
  /** 24h "HH:mm", local to the company timezone (Asia/Makassar). */
  time: string;
  /** Required when cadence === "weekly". 0 = Sunday .. 6 = Saturday. */
  dayOfWeek?: number;
  /** Required when cadence === "monthly". 1-28 (kept safe for short months). */
  dayOfMonth?: number;
  label: string;
  enabled: boolean;
}

export interface ScheduleRunRecord {
  id: string;
  moduleId: AIModuleId;
  cadence: TaskCadence;
  scheduledTime: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "success" | "error";
  reportId?: string;
}

/**
 * A single step in an employee's SOP, declared alongside their code (see
 * each module's `sop.ts`) and mirrored for humans in docs/SOP.md.
 * `offsetMinutes` is minutes after the cadence's scheduled start time —
 * purely descriptive/documentation today; work-logger.ts is what actually
 * records when a step happened.
 */
export interface SOPStep {
  id: string;
  offsetMinutes: number;
  label: string;
}

export interface EmployeeSOP {
  daily?: SOPStep[];
  weekly?: SOPStep[];
  monthly?: SOPStep[];
}

export type WorkLogStatus = "info" | "success" | "error";

/**
 * The granular "what did the AI actually do" trail — e.g. "08:00 Started",
 * "08:12 Research Completed", "08:15 Saved Memory", "08:20 Finished".
 * Written by WorkLogger (packages/ai-engine/src/core/work-logger.ts) at
 * each SOP milestone, one entry per step, tied to a single run via `runId`.
 */
export interface WorkLogEntry {
  id: string;
  moduleId: AIModuleId;
  runId: string;
  cadence: TaskCadence;
  step: string;
  status: WorkLogStatus;
  detail?: string;
  loggedAt: string;
}
