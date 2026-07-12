import { describe, expect, it } from "vitest";
import { ApprovalError } from "@mkh/security";
import { getRepository, resetRepositoryCache } from "@mkh/database";
import { NoActionRequiredError, decideOnApproval, proposeAction } from "./workflow";
import type { CampaignRecommendation } from "./types";

function actionableRecommendation(overrides: Partial<CampaignRecommendation> = {}): CampaignRecommendation {
  return {
    campaignId: "cmp_test",
    campaignName: "Test Campaign",
    action: "decrease_budget",
    reason: "CPL too high",
    proposedChange: { dailyBudgetIdr: 200_000 },
    ...overrides,
  };
}

describe("proposeAction", () => {
  it("creates and persists a pending approval request for an actionable recommendation", async () => {
    resetRepositoryCache();
    const approval = await proposeAction(actionableRecommendation());

    expect(approval.status).toBe("pending");
    expect(approval.moduleId).toBe("meta-ads-operator");

    const persisted = await getRepository().getApproval(approval.id);
    expect(persisted).not.toBeNull();
    expect(persisted?.campaignId).toBe("cmp_test");
  });

  it("refuses to propose an action for a no_action recommendation", async () => {
    resetRepositoryCache();
    await expect(proposeAction(actionableRecommendation({ action: "no_action" }))).rejects.toThrow(NoActionRequiredError);
  });
});

describe("decideOnApproval", () => {
  it("lets the owner approve a pending request end-to-end (propose -> decide)", async () => {
    resetRepositoryCache();
    const approval = await proposeAction(actionableRecommendation());
    const decided = await decideOnApproval(approval.id, "approved", { role: "owner", name: "Owner" });

    expect(decided.status).toBe("approved");
    const persisted = await getRepository().getApproval(approval.id);
    expect(persisted?.status).toBe("approved");
  });

  it("rejects a decision from a non-owner role", async () => {
    resetRepositoryCache();
    const approval = await proposeAction(actionableRecommendation());
    await expect(decideOnApproval(approval.id, "approved", { role: "markom", name: "Someone" })).rejects.toThrow(ApprovalError);
  });

  it("throws for an unknown approval id", async () => {
    resetRepositoryCache();
    await expect(decideOnApproval("apr_does_not_exist", "approved", { role: "owner", name: "Owner" })).rejects.toThrow(
      "not found",
    );
  });
});
