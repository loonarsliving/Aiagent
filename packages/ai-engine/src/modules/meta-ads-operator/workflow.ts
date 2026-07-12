import type { ActionLogEntry, ApprovalRequest } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { assertApproved, buildActionLogEntry, createApprovalRequest, decideApproval, type Role } from "@mkh/security";
import { executeMetaAdsAction } from "@mkh/connectors";
import type { CampaignRecommendation } from "./types";

export class NoActionRequiredError extends Error {}

/** Stage 2, step 1: turn an actionable recommendation into a pending approval request for the Owner. */
export async function proposeAction(recommendation: CampaignRecommendation): Promise<ApprovalRequest> {
  if (recommendation.action === "no_action") {
    throw new NoActionRequiredError(`Campaign ${recommendation.campaignId} has no actionable recommendation`);
  }
  const approval = createApprovalRequest({
    moduleId: "meta-ads-operator",
    actionType: recommendation.action,
    campaignId: recommendation.campaignId,
    campaignName: recommendation.campaignName,
    reason: recommendation.reason,
    proposedChange: recommendation.proposedChange,
  });
  return getRepository().saveApproval(approval);
}

/** Stage 2, step 2: Owner approves or rejects. Only "owner" role is authorized (see @mkh/security roles). */
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

/** Stage 2, step 3: execute — only reachable once status === "approved"; every outcome is written to action_logs. */
export async function executeApprovedAction(approvalId: string): Promise<ActionLogEntry> {
  const repo = getRepository();
  const approval = await repo.getApproval(approvalId);
  if (!approval) throw new Error(`Approval ${approvalId} not found`);

  assertApproved(approval);

  const result = await executeMetaAdsAction(approval.actionType, approval.campaignId, approval.proposedChange);
  const entry = buildActionLogEntry(approval, result.success ? "executed" : "failed", result.detail);
  return repo.saveActionLog(entry);
}
