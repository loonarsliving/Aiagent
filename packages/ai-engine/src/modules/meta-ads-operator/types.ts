import type { MetaAdsActionType } from "@mkh/shared";

export interface CampaignMetrics {
  campaignId: string;
  name: string;
  status: "active" | "paused";
  dailyBudgetIdr: number;
  spendIdr: number;
  impressions: number;
  clicks: number;
  leads: number;
  /** Cost per lead, in IDR. null when there are zero leads (undefined ratio). */
  cplIdr: number | null;
  /** Click-through rate, percent. */
  ctrPct: number;
  /** Cost per click, in IDR. null when there are zero clicks. */
  cpcIdr: number | null;
}

export interface CampaignRecommendation {
  campaignId: string;
  campaignName: string;
  action: MetaAdsActionType | "no_action";
  reason: string;
  proposedChange: Record<string, unknown>;
}

export interface MetaAdsAnalysisData {
  campaigns: CampaignMetrics[];
  recommendations: CampaignRecommendation[];
  /** ApprovalRequest ids created this run via workflow.proposeAction — one per actionable recommendation. */
  proposedApprovalIds: string[];
}

export interface WeeklyCampaignComparison {
  periodLabel: string;
  daysAggregated: number;
  totalActionableRecommendations: number;
  /** Campaign names that needed action on more than one day this week — worth a closer look. */
  recurringCampaignIssues: string[];
}

export interface MonthlyAdsRecap {
  periodLabel: string;
  daysAggregated: number;
  totalApprovalsProposed: number;
  approvalOutcomes: { approved: number; rejected: number; pending: number };
  note: string;
}
