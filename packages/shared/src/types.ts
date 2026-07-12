/**
 * The ten cadence-scheduled digital employees. The Notification Coordinator
 * (packages/notifications) is deliberately NOT in this list — it's an
 * always-on dispatch service every employee calls through, not a
 * cadence-based worker with its own daily/weekly/monthly SOP. See
 * docs/ARCHITECTURE.md for why that's a distinct kind of thing.
 */
export const AI_MODULE_IDS = [
  "ceo-assistant",
  "marketing-intelligence",
  "content-planner",
  "meta-ads-specialist",
  "sales-supervisor",
  "branch-performance-manager",
  "finance-analyst",
  "hr-officer",
  "ota-manager",
  "sop-guardian",
] as const;

export type AIModuleId = (typeof AI_MODULE_IDS)[number];

export type AIRunStatus = "success" | "error";

export interface AIRunContext {
  /** What kicked this run off — a scheduler slot, the manual-trigger service, or another employee (e.g. ceo-assistant reading others). */
  triggeredBy: "scheduler" | "manual" | "module";
  /** ISO timestamp; defaults to "now" if omitted by the caller. */
  runAt?: string;
  /** Who/what asked for a manual trigger — free text (e.g. "operator:cli", later "mk-connect"). Only meaningful when triggeredBy === "manual". */
  requestedBy?: string;
}

/**
 * The standard envelope every AI employee's task returns. `data` is
 * task-specific and typed by each employee; `summary` is what shows up in
 * logs and in the CEO Assistant's rollup.
 *
 * `durationMs` and `retryCount` are NOT set by employee task methods —
 * they're attached by `runEmployeeTask` (packages/ai-engine/src/core/agent-runner.ts)
 * after the fact, which is why they're optional here. Any report read back
 * from the Repository (i.e. anything that went through the runner) will
 * always have both populated.
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
  /** Wall-clock time the task took, including any retries. Attached by the runner. */
  durationMs?: number;
  /** How many retry attempts were needed (0 = succeeded on the first try). Attached by the runner. */
  retryCount?: number;
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type MetaAdsActionType =
  | "increase_budget"
  | "decrease_budget"
  | "pause_campaign"
  | "activate_campaign"
  | "launch_new_campaign";

/**
 * The output of Meta Ads Specialist's workflow: a proposed action awaiting
 * Owner decision — status "pending" here IS "WAITING OWNER APPROVAL" (see
 * docs/SOP.md). Covers both adjustments to an existing campaign
 * (increase/decrease/pause/activate) and brand-new campaign proposals
 * (launch_new_campaign, with objective/audience/budget/creative/publish
 * time packed into `proposedChange`) — same lifecycle either way, reusing
 * the existing approval state machine rather than introducing a parallel
 * one. Execution against a real ad account is a separate, not-yet-built
 * phase — this type only covers propose/decide.
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
  /** "HH:mm" for a scheduled run, or "manual" for a manually-triggered one. */
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

export type WorkLogStatus = "info" | "success" | "error" | "retry";

/**
 * The granular "what did the AI actually do" trail — e.g. "08:00 Started",
 * "08:12 Research Completed", "08:15 Saved Memory", "08:20 Finished".
 * Written by WorkLogger (packages/ai-engine/src/core/work-logger.ts) at
 * each SOP milestone, one entry per step, tied to a single run via `runId`.
 * A `status: "retry"` entry is written each time the runner retries a
 * failed attempt — see `attempt` below.
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
  /** Which attempt this step belongs to (0 = first try, 1 = first retry, ...). Omitted for cadences that never needed a retry. */
  attempt?: number;
}
