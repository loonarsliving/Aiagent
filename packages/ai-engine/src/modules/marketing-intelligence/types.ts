/**
 * Marketing Intelligence is a researcher, not a designer — its outputs are
 * findings and raw content opportunities. Turning `contentChecklist` into
 * an assigned, tracked weekly checklist is Marketing Operation's job.
 */
export interface DailyResearchSummary {
  newSignals: number;
  recurringSignals: number;
  totalKnowledgeItems: number;
  topOpportunities: string[];
  dailyRecommendation: string;
  contentChecklist: string[];
}

export interface WeeklyStrategy {
  periodLabel: string;
  daysAggregated: number;
  knowledgeGrowth: { newThisWeek: number; recurringThisWeek: number };
  strategicThemes: string[];
  focusForNextWeek: string;
}

export interface MonthlyRetrospective {
  periodLabel: string;
  totalKnowledgeItems: number;
  byCategory: Record<string, number>;
  mostRecurringThemes: { title: string; timesSeen: number }[];
  retrospectiveNote: string;
}
