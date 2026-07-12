import { describe, expect, it } from "vitest";
import { ROLES, canApprove } from "./roles";

describe("canApprove", () => {
  it("only grants meta-ads:approve-action to the owner role", () => {
    expect(canApprove("owner", "meta-ads:approve-action")).toBe(true);
  });

  it("denies every non-owner role for meta-ads:approve-action", () => {
    for (const role of ROLES) {
      if (role === "owner") continue;
      expect(canApprove(role, "meta-ads:approve-action")).toBe(false);
    }
  });
});

describe("ROLES", () => {
  it("includes the system role for AI-initiated actions", () => {
    expect(ROLES).toContain("system");
  });

  it("has no duplicate entries", () => {
    expect(new Set(ROLES).size).toBe(ROLES.length);
  });
});
