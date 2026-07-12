import { generateId } from "@mkh/shared";
import type { ApprovalRequest, ApprovalStatus, MetaAdsActionType } from "@mkh/shared";
import { canApprove, type Role } from "./roles";

export class ApprovalError extends Error {}

export interface CreateApprovalInput {
  moduleId: ApprovalRequest["moduleId"];
  actionType: MetaAdsActionType;
  campaignId: string;
  campaignName: string;
  reason: string;
  proposedChange: Record<string, unknown>;
}

/** Pure constructor — persistence is the caller's job (via the database Repository). */
export function createApprovalRequest(input: CreateApprovalInput): ApprovalRequest {
  return {
    id: generateId("apr"),
    moduleId: input.moduleId,
    actionType: input.actionType,
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    reason: input.reason,
    proposedChange: input.proposedChange,
    status: "pending",
    requestedAt: new Date().toISOString(),
  };
}

export function decideApproval(
  request: ApprovalRequest,
  decision: Extract<ApprovalStatus, "approved" | "rejected">,
  decidedBy: { role: Role; name: string },
): ApprovalRequest {
  if (request.status !== "pending") {
    throw new ApprovalError(`Approval ${request.id} already ${request.status}`);
  }
  if (!canApprove(decidedBy.role, "meta-ads:approve-action")) {
    throw new ApprovalError(`Role "${decidedBy.role}" is not authorized to approve Meta Ads actions`);
  }
  return {
    ...request,
    status: decision,
    decidedAt: new Date().toISOString(),
    decidedBy: decidedBy.name,
  };
}

/** Gate every Meta Ads action executor must call before touching a real (or mocked) connector. */
export function assertApproved(request: ApprovalRequest): void {
  if (request.status !== "approved") {
    throw new ApprovalError(
      `Cannot execute action for approval ${request.id}: status is "${request.status}", expected "approved"`,
    );
  }
}
