import { generateId } from "@mkh/shared";
import type { ActionLogEntry, ApprovalRequest } from "@mkh/shared";

/** Builds the immutable audit record for an executed (or failed) approved action. */
export function buildActionLogEntry(
  approval: ApprovalRequest,
  result: ActionLogEntry["result"],
  detail: string,
): ActionLogEntry {
  return {
    id: generateId("act"),
    approvalId: approval.id,
    actionType: approval.actionType,
    campaignId: approval.campaignId,
    executedAt: new Date().toISOString(),
    result,
    detail,
  };
}
