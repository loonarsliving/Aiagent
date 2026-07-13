import { describe, expect, it } from "vitest";
import { AI_MODULE_IDS } from "@mkh/shared";
import {
  APPROVAL_LEVEL_LABELS,
  GOVERNANCE_PROFILES,
  getGovernanceProfile,
  isActionWithinPermission,
  requiresHumanApproval,
} from "./governance";

const ALL_WORKER_IDS = [...AI_MODULE_IDS, "notification-coordinator"] as const;

describe("GOVERNANCE_PROFILES", () => {
  it("has a profile for every one of the 10 employees plus the Notification Coordinator", () => {
    for (const id of ALL_WORKER_IDS) {
      expect(GOVERNANCE_PROFILES[id]).toBeDefined();
      expect(GOVERNANCE_PROFILES[id].moduleId).toBe(id);
    }
    expect(Object.keys(GOVERNANCE_PROFILES)).toHaveLength(ALL_WORKER_IDS.length);
  });

  it("every profile declares a non-empty forbiddenActions list", () => {
    for (const id of ALL_WORKER_IDS) {
      expect(GOVERNANCE_PROFILES[id].forbiddenActions.length).toBeGreaterThan(0);
    }
  });

  it("every profile declares non-empty escalation/owner/dirOps/branchManager rule text", () => {
    for (const id of ALL_WORKER_IDS) {
      const profile = GOVERNANCE_PROFILES[id];
      expect(profile.escalationRules.length).toBeGreaterThan(0);
      expect(profile.ownerApprovalRules.length).toBeGreaterThan(0);
      expect(profile.dirOpsApprovalRules.length).toBeGreaterThan(0);
      expect(profile.branchManagerApprovalRules.length).toBeGreaterThan(0);
    }
  });

  it("autoActionLevel never exceeds permissionLevel for any worker", () => {
    for (const id of ALL_WORKER_IDS) {
      const profile = GOVERNANCE_PROFILES[id];
      expect(profile.autoActionLevel).toBeLessThanOrEqual(profile.permissionLevel);
    }
  });

  it("only meta-ads-specialist has a permissionLevel above 1 today (every other worker is read/suggestion only)", () => {
    for (const id of ALL_WORKER_IDS) {
      const profile = GOVERNANCE_PROFILES[id];
      if (id === "meta-ads-specialist") {
        expect(profile.permissionLevel).toBe(4);
      } else {
        expect(profile.permissionLevel).toBeLessThanOrEqual(1);
      }
    }
  });

  it("meta-ads-specialist is the only worker whose requiresApprovalLevel is set (Owner-gated)", () => {
    for (const id of ALL_WORKER_IDS) {
      const profile = GOVERNANCE_PROFILES[id];
      if (id === "meta-ads-specialist") {
        expect(profile.requiresApprovalLevel).toBe(4);
      } else {
        expect(profile.requiresApprovalLevel).toBeNull();
      }
    }
  });
});

describe("APPROVAL_LEVEL_LABELS", () => {
  it("labels all 5 levels of the Approval Matrix", () => {
    expect(APPROVAL_LEVEL_LABELS).toEqual({
      0: "Read Only",
      1: "Suggestion Only",
      2: "Requires Branch Manager Approval",
      3: "Requires Director Operations Approval",
      4: "Requires Owner Approval",
    });
  });
});

describe("getGovernanceProfile", () => {
  it("resolves a registered worker id", () => {
    expect(getGovernanceProfile("finance-analyst").moduleId).toBe("finance-analyst");
  });

  it("throws for an unregistered id", () => {
    // @ts-expect-error deliberately invalid id to exercise the error path
    expect(() => getGovernanceProfile("not-a-real-worker")).toThrow(/No GovernanceProfile registered/);
  });
});

describe("isActionWithinPermission", () => {
  it("allows an action at or below the worker's permissionLevel", () => {
    const financeAnalyst = getGovernanceProfile("finance-analyst");
    expect(isActionWithinPermission(financeAnalyst, 0)).toBe(true);
    expect(isActionWithinPermission(financeAnalyst, 1)).toBe(true);
  });

  it("denies an action above the worker's permissionLevel", () => {
    const financeAnalyst = getGovernanceProfile("finance-analyst");
    expect(isActionWithinPermission(financeAnalyst, 2)).toBe(false);
    expect(isActionWithinPermission(financeAnalyst, 4)).toBe(false);
  });

  it("meta-ads-specialist may reach level 4 (its proposals are allowed to become Owner-approval-gated requests)", () => {
    const metaAds = getGovernanceProfile("meta-ads-specialist");
    expect(isActionWithinPermission(metaAds, 4)).toBe(true);
  });
});

describe("requiresHumanApproval", () => {
  it("returns false for a worker with no approval-gated actions (requiresApprovalLevel is null)", () => {
    const hrOfficer = getGovernanceProfile("hr-officer");
    expect(requiresHumanApproval(hrOfficer, 4)).toBe(false);
  });

  it("returns true for meta-ads-specialist at or above its requiresApprovalLevel", () => {
    const metaAds = getGovernanceProfile("meta-ads-specialist");
    expect(requiresHumanApproval(metaAds, 4)).toBe(true);
  });

  it("returns false for meta-ads-specialist below its requiresApprovalLevel", () => {
    const metaAds = getGovernanceProfile("meta-ads-specialist");
    expect(requiresHumanApproval(metaAds, 1)).toBe(false);
  });
});
