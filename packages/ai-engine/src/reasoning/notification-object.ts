import type { AIModuleId, ApprovalLevel, NotificationChannelType, NotificationObject, ReasoningOutput } from "@mkh/shared";

/**
 * Every employee's real notify() call target today (see each module.ts's
 * `notify({ target: ... })`) — reused here so the AI-generated
 * NotificationObject's `recipient` always agrees with the deterministic
 * notification the employee's own logic.ts already sends, rather than a
 * second, possibly-conflicting opinion about who should be notified.
 */
const DEFAULT_RECIPIENT: Record<AIModuleId, string> = {
  "ceo-assistant": "owner",
  "marketing-intelligence": "markom",
  "content-planner": "markom",
  "meta-ads-specialist": "owner",
  "sales-supervisor": "dir_ops",
  "branch-performance-manager": "dir_ops",
  "finance-analyst": "owner",
  "hr-officer": "hr",
  "ota-manager": "dir_ops",
  "sop-guardian": "dir_ops",
};

/**
 * "Generate Notification" pipeline step — turns a validated ReasoningOutput
 * into a structured Notification Object. This is NOT a live send: `channel`
 * is always a placeholder (see NotificationChannelType), and building this
 * object never calls @mkh/notifications' notify() or any external API.
 * Sprint 3A explicitly forbids connecting WhatsApp/Meta/OTA/MK Connect —
 * this object is what a future connected channel would eventually receive.
 */
export function buildNotificationObject(
  moduleId: AIModuleId,
  output: ReasoningOutput,
  approvalLevel: ApprovalLevel,
  channel: NotificationChannelType = "dummy",
): NotificationObject {
  return {
    recipient: DEFAULT_RECIPIENT[moduleId],
    priority: output.priority,
    title: output.summary,
    message: output.recommendation,
    reason: output.reason,
    suggestedAction: output.nextAction,
    escalation: output.escalation,
    channel,
    approvalLevel,
    sourceModuleId: moduleId,
    createdAt: new Date().toISOString(),
  };
}
