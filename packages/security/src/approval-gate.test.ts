import { describe, expect, it } from "vitest";
import { ApprovalError, assertApproved, createApprovalRequest, decideApproval } from "./approval-gate";

function baseInput() {
  return {
    moduleId: "meta-ads-specialist" as const,
    actionType: "decrease_budget" as const,
    campaignId: "cmp_1",
    campaignName: "Test Campaign",
    reason: "CPL too high",
    proposedChange: { dailyBudgetIdr: 200_000 },
  };
}

describe("createApprovalRequest", () => {
  it("creates a pending approval request", () => {
    const approval = createApprovalRequest(baseInput());
    expect(approval.status).toBe("pending");
    expect(approval.id).toMatch(/^apr_/);
  });
});

describe("decideApproval", () => {
  it("only allows the owner role to approve", () => {
    const approval = createApprovalRequest(baseInput());
    expect(() => decideApproval(approval, "approved", { role: "sales", name: "Someone" })).toThrow(ApprovalError);
  });

  it("allows the owner to approve a pending request", () => {
    const approval = createApprovalRequest(baseInput());
    const decided = decideApproval(approval, "approved", { role: "owner", name: "Owner" });
    expect(decided.status).toBe("approved");
    expect(decided.decidedBy).toBe("Owner");
  });

  it("rejects deciding an already-decided approval again", () => {
    const approval = createApprovalRequest(baseInput());
    const decided = decideApproval(approval, "approved", { role: "owner", name: "Owner" });
    expect(() => decideApproval(decided, "rejected", { role: "owner", name: "Owner" })).toThrow(ApprovalError);
  });
});

describe("assertApproved", () => {
  it("throws for a pending approval", () => {
    const approval = createApprovalRequest(baseInput());
    expect(() => assertApproved(approval)).toThrow(ApprovalError);
  });

  it("passes silently for an approved approval", () => {
    const approval = createApprovalRequest(baseInput());
    const decided = decideApproval(approval, "approved", { role: "owner", name: "Owner" });
    expect(() => assertApproved(decided)).not.toThrow();
  });
});
