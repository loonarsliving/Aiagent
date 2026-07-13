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
  /**
   * Sprint 2 — the Reasoning Engine's AI-generated layer on top of `data`.
   * Optional: a module that hasn't called the Reasoning Engine (or whose
   * reasoning call failed) simply omits this; `data` (deterministic,
   * provider-agnostic) is always present regardless.
   */
  aiReasoning?: ReasoningResult;
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
  /** "skipped" — Sprint 3B: another process already held the distributed scheduler lock for this moduleId+cadence slot, so this run never called the employee. */
  status: "running" | "success" | "error" | "skipped";
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

// ============================================================================
// Sprint 2 — AI Provider Layer / Reasoning Engine
// ============================================================================

/**
 * Canonical home for this type — @mkh/ai-provider imports it from here
 * (never the other way) so the plug-and-play provider contract and the
 * cross-cutting envelope types (AIReasoningLogEntry, AIReport.aiReasoning)
 * agree on the same union without @mkh/shared depending on @mkh/ai-provider.
 */
export type AIProviderName = "gemini" | "claude" | "openai" | "ollama";

export type ReasoningPriority = "low" | "medium" | "high" | "urgent";

/**
 * The Output Engine's standard envelope — every Digital Employee's
 * reasoning call produces exactly this shape, regardless of provider.
 * Attached to `AIReport.aiReasoning`; never replaces the deterministic
 * `AIReport.data` a module's own logic.ts already computed.
 */
export interface ReasoningOutput {
  priority: ReasoningPriority;
  summary: string;
  recommendation: string;
  reason: string;
  /** 0-1. */
  confidenceScore: number;
  needApproval: boolean;
  /** Who/what this should escalate to, or null when nothing needs escalating. */
  escalation: string | null;
  nextAction: string;
}

/**
 * A structured result returned instead of throwing when reasoning fails
 * even after retries — see packages/ai-engine/src/reasoning/reasoning-engine.ts.
 * Keeps the "never throw to the caller" guarantee Sprint 1 established for
 * runEmployeeTask, now also true for the reasoning layer.
 */
export interface ReasoningFailure {
  failed: true;
  reason: string;
}

/**
 * Sprint 3A — a Notification Object, not a live send. Every recommendation
 * that reaches "Generate Notification" in the reasoning pipeline produces
 * one of these; `channel` is always a placeholder (see NotificationChannelType)
 * since no external channel is connected in this sprint — dispatching it is
 * a separate concern (`@mkh/notifications`'s `notify()`), and nothing here
 * calls out to WhatsApp/Meta/OTA/MK Connect.
 */
export interface NotificationObject {
  recipient: string;
  priority: ReasoningPriority;
  title: string;
  message: string;
  reason: string;
  suggestedAction: string;
  escalation: string | null;
  /** Always "dummy" until a real channel is connected — see docs/CONNECTORS.md. */
  channel: NotificationChannelType;
  approvalLevel: ApprovalLevel;
  sourceModuleId: AIModuleId;
  createdAt: string;
}

/**
 * The governance layer applied on top of the raw Output Engine result:
 * `approvalLevel` is computed deterministically from the worker's own
 * GovernanceProfile (never self-reported by the model), and `notification`
 * is the "Generate Notification" pipeline step's output. See
 * packages/ai-engine/src/reasoning/reasoning-engine.ts.
 */
export interface GovernedReasoningOutput extends ReasoningOutput {
  approvalLevel: ApprovalLevel;
  notification: NotificationObject;
}

export type ReasoningResult = (GovernedReasoningOutput & { failed?: false }) | ReasoningFailure;

/**
 * The audit trail for every AIProvider call — distinct from WorkLogEntry
 * (which logs SOP *steps*; this logs AI provider *calls* specifically:
 * provider, response time, token usage, retry count, success/failure and
 * why). One row per reasoning attempt sequence (not per individual retry).
 */
export interface AIReasoningLogEntry {
  id: string;
  moduleId: AIModuleId;
  runId: string;
  provider: AIProviderName;
  model: string;
  status: "success" | "error";
  /** Total wall-clock time across all retry attempts. */
  responseTimeMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  /** How many retries were needed (0 = succeeded on the first attempt). */
  retryCount: number;
  /** Populated only when status === "error". */
  errorReason?: string;
  createdAt: string;
}

/**
 * The Approval Matrix — every action any AI Worker can take is classified
 * into exactly one of these five levels. Enforced by
 * `@mkh/security`'s governance layer (see `docs/AI_GOVERNANCE.md`):
 *
 * - 0 — Read Only. Observing data, no output that could influence a decision.
 * - 1 — Suggestion Only. A recommendation, notification, or report — never
 *   executes anything and never requires a human decision before it happens.
 * - 2 — Requires Branch Manager approval.
 * - 3 — Requires Director Operations approval.
 * - 4 — Requires Owner approval.
 *
 * No AI Worker may execute an action above its own `permissionLevel`.
 */
export type ApprovalLevel = 0 | 1 | 2 | 3 | 4;

/**
 * One governance profile per AI Worker (the 10 `AIEmployee`s plus the
 * Notification Coordinator, mirroring `PromptDefinition["moduleId"]`).
 * This is declarative data, not enforcement by itself — enforcement is
 * `@mkh/security`'s `isActionWithinPermission`/`requiresHumanApproval`
 * helpers, which any future caller (a real execute() path, MK Connect)
 * must check before acting.
 */
export interface GovernanceProfile {
  moduleId: AIModuleId | "notification-coordinator";
  /** The highest ApprovalLevel this worker may ever reach — a hard ceiling. */
  permissionLevel: ApprovalLevel;
  /** At or below this level, the worker may act with zero human approval. */
  autoActionLevel: ApprovalLevel;
  /**
   * The level at which this worker's actions require a human decision
   * before they take effect. `null` means nothing this worker does today
   * reaches an approval-gated action (its ceiling is a Level 1 suggestion).
   */
  requiresApprovalLevel: ApprovalLevel | null;
  /** Actions this worker must never perform, under any circumstance. */
  forbiddenActions: string[];
  /** When and how this worker escalates instead of acting on its own. */
  escalationRules: string;
  /** What specifically requires the Owner's sign-off for this worker. */
  ownerApprovalRules: string;
  /** What specifically requires Director Operations' sign-off for this worker. */
  dirOpsApprovalRules: string;
  /** What specifically requires a Branch Manager's sign-off for this worker. */
  branchManagerApprovalRules: string;
}

// ─── Sprint 3B — AI Infrastructure (no external API) ───────────────────

export type JobStatus = "pending" | "running" | "success" | "failed" | "dead";

export type JobPriority = "low" | "normal" | "high" | "urgent";

/**
 * A generic, durable, retryable unit of async work — the one queue
 * abstraction backing everything that needs "run this later, retry it if
 * it fails, give up cleanly if it keeps failing": the Notification Queue
 * (`type: "notification-dispatch"`) today, any future async job type
 * without a new table. Persisted through `Repository` so it survives a
 * process restart under `DATA_MODE=supabase` — an in-memory-only queue
 * cannot claim "recovery after crash."
 */
export interface QueueJob<TPayload = unknown> {
  id: string;
  type: string;
  payload: TPayload;
  priority: JobPriority;
  status: JobStatus;
  /** ISO timestamp — a job is only claimable once `runAt` has passed; this is what makes a job "delayed" or a scheduled retry. */
  runAt: string;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A lease-based distributed lock — `expiresAt` is what gives "recovery
 * after crash": a holder that dies without releasing its lock is
 * automatically supersedable once `expiresAt` passes, rather than
 * deadlocking the slot forever. See packages/scheduler/src/distributed-lock.ts.
 */
export interface SchedulerLock {
  lockKey: string;
  holderId: string;
  acquiredAt: string;
  expiresAt: string;
}

/**
 * The actual prompt/response exchange for one reasoning call — distinct
 * from `AIReasoningLogEntry` (which is metadata: tokens, timing, status).
 * Kept as a separate persisted record so debugging/auditing a specific
 * AI decision doesn't require replaying the Retrieval Layer against
 * possibly-since-changed knowledge/memory — the exact text sent and
 * received is captured verbatim.
 */
export interface ConversationLogEntry {
  id: string;
  moduleId: AIModuleId;
  runId: string;
  systemPrompt: string;
  userPrompt: string;
  responseText: string;
  createdAt: string;
}

// ─── Sprint 4A — Integration Layer (interfaces + mocks, no external API) ─

/**
 * Every external channel this system will eventually speak to. The real
 * WhatsApp Cloud API / Meta Marketing API / Telegram Bot API / an email
 * provider / MK Connect / an OTA API each become one adapter implementing
 * the same `Connector` interface (packages/integrations/src/connector.ts)
 * — adding a 7th connector type here is the only change a 7th channel
 * requires at the type level.
 */
export const CONNECTOR_TYPES = ["whatsapp", "telegram", "email", "meta", "mkconnect", "ota"] as const;
export type ConnectorType = (typeof CONNECTOR_TYPES)[number];

/**
 * "mock" is distinct from "connected"/"disconnected" — it means the
 * connector is fully operable (every capability works, requests/responses
 * are logged) but backed by a mock implementation rather than a live
 * external API, which is the state of every connector in this system today.
 */
export type ConnectorStatus = "connected" | "disconnected" | "mock" | "error";

export type IntegrationDirection = "outgoing" | "incoming";

/**
 * One row per request that crossed a connector boundary, in either
 * direction — Part 2's "store every outgoing request / every incoming
 * request / response status / timestamps," all in one generic log rather
 * than a table per connector per direction.
 */
export interface IntegrationLogEntry {
  id: string;
  connector: ConnectorType;
  direction: IntegrationDirection;
  /** The request body (outgoing) or the raw webhook payload (incoming). */
  payload: unknown;
  status: "success" | "error" | "pending";
  /** An HTTP-style status code — synthetic for a mock connector, the real response status once a live connector (e.g. Sprint 4B's WhatsApp Cloud API connector) is active. */
  responseStatus?: number;
  error?: string;
  /** Round-trip time in ms for this specific call — absent for mock connectors (nothing to measure), present for live ones so the dashboard can surface real latency. */
  latencyMs?: number;
  createdAt: string;
}

/**
 * A channel-agnostic outbound message body. Every connector's
 * `sendMessage`/`sendMedia`/`sendTemplate`/`broadcast` accepts this same
 * shape — the Notification Engine never special-cases WhatsApp (or any
 * other channel) to decide what a "message" looks like.
 */
export type OutboundMessageContent =
  | { kind: "text"; text: string }
  | { kind: "image"; url: string; caption?: string }
  | { kind: "pdf"; url: string; filename: string }
  | { kind: "template"; templateName: string; params: Record<string, string> }
  | { kind: "buttons"; text: string; buttons: { id: string; label: string }[] };

export type ChatConversationStatus = "open" | "routed" | "closed";

export interface ChatMessage {
  id: string;
  direction: IntegrationDirection;
  content: OutboundMessageContent | { kind: "raw"; text: string };
  createdAt: string;
}

/**
 * Every incoming message becomes (or continues) exactly one of these —
 * Part 8's Conversation Engine. `assignedAgent` is set once the AI Router
 * (packages/integrations/src/ai-router.ts) resolves a destination worker;
 * `null` means unrouted. Named `ChatConversation` (not `Conversation`) to
 * stay unambiguous next to `ConversationLogEntry` above, which is a
 * completely different thing (one AI reasoning call's prompt/response).
 */
export interface ChatConversation {
  id: string;
  connector: ConnectorType;
  /** Opaque external identity — a WhatsApp phone number, a Telegram chat id, an email address. Never validated/parsed here; that's the connector's job. */
  sender: string;
  intent: string | null;
  assignedAgent: AIModuleId | null;
  status: ChatConversationStatus;
  /** Oldest first. The most recent entry is "the message" that last changed this conversation's state. */
  history: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}
