import type { ApprovalLevel, GovernanceProfile } from "@mkh/shared";

/** Human-readable label for each level of the Approval Matrix — see `docs/AI_GOVERNANCE.md`. */
export const APPROVAL_LEVEL_LABELS: Record<ApprovalLevel, string> = {
  0: "Read Only",
  1: "Suggestion Only",
  2: "Requires Branch Manager Approval",
  3: "Requires Director Operations Approval",
  4: "Requires Owner Approval",
};

/**
 * One governance profile per AI Worker. This is declarative — it does not
 * by itself stop anything from running. Every one of today's 10
 * `AIEmployee`s plus the Notification Coordinator is read-only or
 * suggestion-only in actual runtime behavior (permissionLevel 1) except
 * Meta Ads Specialist, whose proposed campaign actions are gated to
 * Owner-only approval via `@mkh/security`'s existing `canApprove()` — that
 * gate is real, enforced code (`approval-gate.ts`), not just a governance
 * label. See `docs/AI_GOVERNANCE.md` for the full narrative per worker.
 */
export const GOVERNANCE_PROFILES: Record<GovernanceProfile["moduleId"], GovernanceProfile> = {
  "ceo-assistant": {
    moduleId: "ceo-assistant",
    permissionLevel: 1,
    autoActionLevel: 1,
    requiresApprovalLevel: null,
    forbiddenActions: [
      "Approve or reject any Approval Request on the Owner's behalf",
      "Modify another employee's report, memory, or work log",
      "Trigger a sibling employee's run outside the existing on-demand-freshness mechanism (getOrRunLatestDaily)",
    ],
    escalationRules:
      "Recurring attention themes are surfaced to the Owner via the daily Executive Summary; CEO Assistant never acts on them itself, only reports.",
    ownerApprovalRules:
      "Every Executive Summary is for Owner visibility only — no Owner action is auto-triggered by it.",
    dirOpsApprovalRules: "Not applicable — CEO Assistant has no Dir Ops-gated action today.",
    branchManagerApprovalRules: "Not applicable.",
  },
  "marketing-intelligence": {
    moduleId: "marketing-intelligence",
    permissionLevel: 1,
    autoActionLevel: 1,
    requiresApprovalLevel: null,
    forbiddenActions: [
      "Publish or schedule any content — Marketing Intelligence researches, it never designs or posts",
      "Write to another employee's knowledge base",
    ],
    escalationRules: "New/recurring signals are sent to Markom via notify(); no autonomous follow-up action.",
    ownerApprovalRules: "Not applicable — nothing this worker does today requires Owner sign-off.",
    dirOpsApprovalRules: "Not applicable.",
    branchManagerApprovalRules: "Not applicable.",
  },
  "content-planner": {
    moduleId: "content-planner",
    permissionLevel: 1,
    autoActionLevel: 1,
    requiresApprovalLevel: null,
    forbiddenActions: [
      "Publish content on any channel — no publishing connector exists",
      "Mark a Markom checklist item complete on Markom's behalf",
    ],
    escalationRules: "Overdue checklist items trigger a reminder notification to Markom; Content Planner never escalates beyond that.",
    ownerApprovalRules: "Not applicable.",
    dirOpsApprovalRules: "Not applicable.",
    branchManagerApprovalRules: "Not applicable.",
  },
  "meta-ads-specialist": {
    moduleId: "meta-ads-specialist",
    permissionLevel: 4,
    autoActionLevel: 1,
    requiresApprovalLevel: 4,
    forbiddenActions: [
      "Publish or modify a live Meta Ads campaign — no execute() path exists in this codebase",
      "Auto-approve its own proposed action",
      "Bypass createApprovalRequest() to mutate campaign state directly",
    ],
    escalationRules:
      "Every actionable recommendation and new campaign draft becomes a pending Approval Request (status: WAITING OWNER APPROVAL). Analysis and drafting happen automatically (Level 1); nothing with real-world effect happens until a human decides.",
    ownerApprovalRules:
      "`@mkh/security`'s canApprove() restricts decideOnApproval() to the \"owner\" role exclusively — enforced in code (approval-gate.ts), not just documented here.",
    dirOpsApprovalRules:
      "Not applicable today. Would apply to a future lower-risk action tier (e.g. pausing a single underperforming ad set) if one is introduced — not built yet.",
    branchManagerApprovalRules: "Not applicable — Meta Ads campaigns are company-wide, not per-branch.",
  },
  "sales-supervisor": {
    moduleId: "sales-supervisor",
    permissionLevel: 1,
    autoActionLevel: 1,
    requiresApprovalLevel: null,
    forbiddenActions: [
      "Write to sales data — Repository has no write method for sales records",
      "Assign or reassign a rep's target or territory",
    ],
    escalationRules: "Lagging reps are surfaced to Dir Ops via notify(); recovery/scaling strategy is a suggestion only.",
    ownerApprovalRules: "Not applicable.",
    dirOpsApprovalRules: "Notified (not gated) when reps fall behind target — informational, not an approval request.",
    branchManagerApprovalRules: "Not applicable today — would apply to a future single-branch sales action.",
  },
  "branch-performance-manager": {
    moduleId: "branch-performance-manager",
    permissionLevel: 1,
    autoActionLevel: 1,
    requiresApprovalLevel: null,
    forbiddenActions: [
      "Directly change a branch's target, staffing, or budget — no such Repository write method exists",
      "Act on one branch's data using another branch's context",
    ],
    escalationRules:
      "Per-branch recommendations are surfaced to Dir Ops via notify(). A future branch-level operational action (e.g. reallocating budget within one branch) would require Branch Manager approval (Level 2) before any Dir Ops (Level 3) cross-branch step — not built yet.",
    ownerApprovalRules: "Not applicable today.",
    dirOpsApprovalRules: "Notified when a branch needs attention — informational today, not an approval request.",
    branchManagerApprovalRules:
      "Would gate any future single-branch operational change once an execute path exists for that action (not built yet).",
  },
  "finance-analyst": {
    moduleId: "finance-analyst",
    permissionLevel: 1,
    autoActionLevel: 1,
    requiresApprovalLevel: null,
    forbiddenActions: [
      "Suggest or imply any transaction change — READ ONLY MUTLAK, enforced in its own prompt's RESTRICTION field",
      "Any write to transactions or the ledger — no such Repository method exists",
    ],
    escalationRules: "Anomalous transactions are surfaced to the Owner via notify(); Finance Analyst never acts on them.",
    ownerApprovalRules: "All anomaly notifications route to the Owner; no auto-action follows regardless of severity.",
    dirOpsApprovalRules: "Not applicable.",
    branchManagerApprovalRules: "Not applicable.",
  },
  "hr-officer": {
    moduleId: "hr-officer",
    permissionLevel: 1,
    autoActionLevel: 1,
    requiresApprovalLevel: null,
    forbiddenActions: [
      "Write attendance, leave, or KPI data — no such Repository method exists",
      "Take or recommend disciplinary action beyond coaching",
    ],
    escalationRules: "Flagged staff issues are surfaced to HR/Owner via notify(); coaching recommendations are suggestions only.",
    ownerApprovalRules: "Notified for staff issues, not gated — HR/Owner decide any real follow-up outside this system.",
    dirOpsApprovalRules: "Not applicable.",
    branchManagerApprovalRules: "Notified when a branch's staff need attention — informational, not an approval request.",
  },
  "ota-manager": {
    moduleId: "ota-manager",
    permissionLevel: 1,
    autoActionLevel: 1,
    requiresApprovalLevel: null,
    forbiddenActions: [
      "Apply a price change to any OTA channel — no execute() path exists; connector is mocked",
    ],
    escalationRules:
      "Dynamic pricing recommendations are surfaced via notify(). Once a real OTA execute() path exists, applying a price change would require Director Operations approval (Level 3) given its direct revenue impact — not built yet.",
    ownerApprovalRules: "Not applicable today.",
    dirOpsApprovalRules:
      "Would gate an actual price-change execution once that path is built (not built yet); today's recommendations are informational only.",
    branchManagerApprovalRules: "Not applicable — pricing recommendations are per-property, not per-branch.",
  },
  "sop-guardian": {
    moduleId: "sop-guardian",
    permissionLevel: 1,
    autoActionLevel: 1,
    requiresApprovalLevel: null,
    forbiddenActions: [
      "Modify any other employee's report, memory, or work log",
      "Suppress or silence a violation it detects",
    ],
    escalationRules: "Violations are surfaced to Dir Ops via notify(); SOP Guardian never corrects another employee itself.",
    ownerApprovalRules: "Not applicable.",
    dirOpsApprovalRules: "Notified for every detected violation — informational, not an approval request.",
    branchManagerApprovalRules: "Not applicable.",
  },
  "notification-coordinator": {
    moduleId: "notification-coordinator",
    permissionLevel: 1,
    autoActionLevel: 1,
    requiresApprovalLevel: null,
    forbiddenActions: [
      "Invent facts, numbers, or names not present in the original message",
      "Change the severity or target set by the sending employee",
      "Block or delay a notification because Gemini is unavailable — must always fall back to the original wording",
    ],
    escalationRules:
      "Not applicable — it never independently escalates; it relays whatever severity/target the sending employee already decided, at most polishing wording.",
    ownerApprovalRules: "Not applicable.",
    dirOpsApprovalRules: "Not applicable.",
    branchManagerApprovalRules: "Not applicable.",
  },
};

export function getGovernanceProfile(moduleId: GovernanceProfile["moduleId"]): GovernanceProfile {
  const profile = GOVERNANCE_PROFILES[moduleId];
  if (!profile) throw new Error(`No GovernanceProfile registered for "${moduleId}"`);
  return profile;
}

/** No AI Worker may execute an action above its own permissionLevel. */
export function isActionWithinPermission(profile: GovernanceProfile, actionLevel: ApprovalLevel): boolean {
  return actionLevel <= profile.permissionLevel;
}

/** An action at or above requiresApprovalLevel needs a human decision before it may take effect. */
export function requiresHumanApproval(profile: GovernanceProfile, actionLevel: ApprovalLevel): boolean {
  return profile.requiresApprovalLevel !== null && actionLevel >= profile.requiresApprovalLevel;
}
