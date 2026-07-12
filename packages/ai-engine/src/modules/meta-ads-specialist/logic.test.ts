import { describe, expect, it } from "vitest";
import type { AdCampaign } from "@mkh/connectors";
import {
  CPL_GOOD_IDR,
  CPL_TARGET_IDR,
  computeCampaignMetrics,
  draftNewCampaignProposal,
  newCampaignProposalToRecommendation,
  recommendForCampaign,
} from "./logic";

function campaign(overrides: Partial<AdCampaign> = {}): AdCampaign {
  return {
    campaignId: "cmp_test",
    name: "Test Campaign",
    status: "active",
    objective: "LEAD_GENERATION",
    dailyBudgetIdr: 300_000,
    spendIdr: 3_000_000,
    impressions: 100_000,
    clicks: 2_000,
    leads: 30,
    ...overrides,
  };
}

describe("computeCampaignMetrics", () => {
  it("computes CPL, CTR, and CPC correctly", () => {
    const metrics = computeCampaignMetrics(campaign({ spendIdr: 3_000_000, leads: 30, clicks: 2_000, impressions: 100_000 }));
    expect(metrics.cplIdr).toBe(100_000); // 3,000,000 / 30
    expect(metrics.ctrPct).toBe(2); // 2,000 / 100,000 * 100
    expect(metrics.cpcIdr).toBe(1_500); // 3,000,000 / 2,000
  });

  it("returns null CPL/CPC when there are zero leads/clicks (avoids divide-by-zero)", () => {
    const metrics = computeCampaignMetrics(campaign({ leads: 0, clicks: 0, impressions: 50_000, spendIdr: 500_000 }));
    expect(metrics.cplIdr).toBeNull();
    expect(metrics.cpcIdr).toBeNull();
    expect(metrics.ctrPct).toBe(0);
  });
});

describe("recommendForCampaign", () => {
  it("recommends pause when spend is high and there are zero leads", () => {
    const metrics = computeCampaignMetrics(campaign({ leads: 0, spendIdr: 1_500_000, clicks: 100, impressions: 10_000 }));
    const rec = recommendForCampaign(metrics);
    expect(rec.action).toBe("pause_campaign");
  });

  it("recommends decreasing budget when CPL is above target", () => {
    const metrics = computeCampaignMetrics(
      campaign({ leads: 10, spendIdr: (CPL_TARGET_IDR + 10_000) * 10, clicks: 500, impressions: 20_000 }),
    );
    const rec = recommendForCampaign(metrics);
    expect(rec.action).toBe("decrease_budget");
    expect(rec.proposedChange.dailyBudgetIdr).toBeLessThan(metrics.dailyBudgetIdr);
  });

  it("recommends increasing budget when CPL is well below the good threshold", () => {
    const metrics = computeCampaignMetrics(
      campaign({ leads: 50, spendIdr: (CPL_GOOD_IDR - 5_000) * 50, clicks: 800, impressions: 30_000 }),
    );
    const rec = recommendForCampaign(metrics);
    expect(rec.action).toBe("increase_budget");
    expect(rec.proposedChange.dailyBudgetIdr).toBeGreaterThan(metrics.dailyBudgetIdr);
  });

  it("recommends no action for a campaign performing within normal range", () => {
    const metrics = computeCampaignMetrics(
      campaign({ leads: 20, spendIdr: 60_000 * 20, clicks: 1_000, impressions: 40_000 }),
    );
    const rec = recommendForCampaign(metrics);
    expect(rec.action).toBe("no_action");
  });
});

describe("draftNewCampaignProposal", () => {
  it("returns null when there is no opportunity to act on", () => {
    expect(draftNewCampaignProposal(undefined, new Set())).toBeNull();
  });

  it("drafts a full proposal (objective/audience/budget/creative/publish time) from a strong opportunity", () => {
    const proposal = draftNewCampaignProposal("POV cicilan villa", new Set());
    expect(proposal).not.toBeNull();
    expect(proposal?.objective).toBeTruthy();
    expect(proposal?.audienceDescription).toBeTruthy();
    expect(proposal?.dailyBudgetIdr).toBeGreaterThan(0);
    expect(proposal?.creativeRecommendation).toContain("POV cicilan villa");
    expect(proposal?.suggestedPublishAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("does not re-propose a theme that was already proposed recently", () => {
    const first = draftNewCampaignProposal("POV cicilan villa", new Set());
    const second = draftNewCampaignProposal("POV cicilan villa", new Set([first!.title]));
    expect(second).toBeNull();
  });
});

describe("newCampaignProposalToRecommendation", () => {
  it("converts a proposal into a launch_new_campaign recommendation carrying all proposal fields", () => {
    const proposal = draftNewCampaignProposal("POV cicilan villa", new Set())!;
    const rec = newCampaignProposalToRecommendation(proposal);

    expect(rec.action).toBe("launch_new_campaign");
    expect(rec.campaignName).toBe(proposal.title);
    expect(rec.campaignId).toMatch(/^new_/);
    expect(rec.proposedChange.objective).toBe(proposal.objective);
    expect(rec.proposedChange.dailyBudgetIdr).toBe(proposal.dailyBudgetIdr);
  });
});
