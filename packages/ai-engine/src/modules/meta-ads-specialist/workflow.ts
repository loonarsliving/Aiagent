import type { ApprovalRequest } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { createApprovalRequest, decideApproval, type Role } from "@mkh/security";
import type { CampaignRecommendation } from "./types";

export class NoActionRequiredError extends Error {}

/**
 * Turns an actionable recommendation into a pending Approval Request for
 * the Owner. This is the workflow's full scope for now — no execution
 * step exists yet. Publishing/mutating a real campaign (calling Meta's
 * Marketing API once an approval is decided) is a distinct future phase
 * that needs its own explicit sign-off; see docs/ROADMAP.md.
 */
export async function proposeAction(recommendation: CampaignRecommendation): Promise<ApprovalRequest> {
  if (recommendation.action === "no_action") {
    throw new NoActionRequiredError(`Campaign ${recommendation.campaignId} has no actionable recommendation`);
  }
  const approval = createApprovalRequest({
    moduleId: "meta-ads-specialist",
    actionType: recommendation.action,
    campaignId: recommendation.campaignId,
    campaignName: recommendation.campaignName,
    reason: recommendation.reason,
    proposedChange: recommendation.proposedChange,
  });
  return getRepository().saveApproval(approval);
}

/** Owner approves or rejects a pending request. Only the "owner" role is authorized (see @mkh/security roles). */
export async function decideOnApproval(
  approvalId: string,
  decision: "approved" | "rejected",
  decidedBy: { role: Role; name: string },
): Promise<ApprovalRequest> {
  const repo = getRepository();
  const existing = await repo.getApproval(approvalId);
  if (!existing) throw new Error(`Approval ${approvalId} not found`);
  const updated = decideApproval(existing, decision, decidedBy);
  return repo.updateApproval(updated);
}
