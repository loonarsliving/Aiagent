import { describe, expect, it } from "vitest";
import { AI_MODULE_IDS, type ReasoningOutput } from "@mkh/shared";
import { buildNotificationObject } from "./notification-object";

function output(overrides: Partial<ReasoningOutput> = {}): ReasoningOutput {
  return {
    priority: "high",
    summary: "Ringkasan.",
    recommendation: "Lakukan X.",
    reason: "Karena Y.",
    confidenceScore: 0.8,
    needApproval: true,
    escalation: "owner",
    nextAction: "Pantau besok.",
    ...overrides,
  };
}

describe("buildNotificationObject", () => {
  it("maps every ReasoningOutput field to the correct NotificationObject field", () => {
    const notification = buildNotificationObject("finance-analyst", output(), 4);
    expect(notification).toMatchObject({
      recipient: "owner",
      priority: "high",
      title: "Ringkasan.",
      message: "Lakukan X.",
      reason: "Karena Y.",
      suggestedAction: "Pantau besok.",
      escalation: "owner",
      channel: "dummy",
      approvalLevel: 4,
      sourceModuleId: "finance-analyst",
    });
    expect(notification.createdAt).toBeTruthy();
  });

  it("defaults channel to dummy — always a placeholder, never a live send", () => {
    const notification = buildNotificationObject("hr-officer", output(), 1);
    expect(notification.channel).toBe("dummy");
  });

  it("resolves the correct recipient for every one of the 10 employees, matching each module's real notify() target", () => {
    const expectedRecipients: Record<string, string> = {
      "ceo-assistant": "owner",
      "marketing-intelligence": "markom",
      "content-planner": "markom",
      "meta-ads-specialist": "owner",
      "sales-supervisor": "dir_ops",
      "branch-performance-manager": "dir_ops",
      "finance-analyst": "owner",
      "hr-officer": "hr",
      "ota-manager": "dir_ops",
      "sop-guardian": "dir_ops",
    };
    for (const moduleId of AI_MODULE_IDS) {
      const notification = buildNotificationObject(moduleId, output(), 1);
      expect(notification.recipient).toBe(expectedRecipients[moduleId]);
    }
  });

  it("passes escalation through as null when the reasoning output has no escalation", () => {
    const notification = buildNotificationObject("sop-guardian", output({ escalation: null }), 0);
    expect(notification.escalation).toBeNull();
  });
});
