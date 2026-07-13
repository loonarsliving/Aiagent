export const ROLES = [
  "owner",
  "dir_ops",
  "branch_manager", // approval authority for Level 2 actions in the AI Governance Approval Matrix — see governance.ts
  "markom",
  "sales",
  "finance",
  "system", // the AI system itself, acting on its own behalf (e.g. writing logs)
] as const;

export type Role = (typeof ROLES)[number];

/**
 * Actions gated behind approval today. Kept as a small explicit table
 * (rather than a generic permission matrix) because right now the only
 * role that may approve Meta Ads actions is the Owner — this is the one
 * rule the brief calls out by name, and it should stay easy to audit.
 */
const APPROVAL_AUTHORITY: Record<string, Role[]> = {
  "meta-ads:approve-action": ["owner"],
};

export function canApprove(role: Role, action: keyof typeof APPROVAL_AUTHORITY): boolean {
  return APPROVAL_AUTHORITY[action]?.includes(role) ?? false;
}
