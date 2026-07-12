export type ChecklistPriority = "high" | "medium" | "low";

export interface ChecklistItem {
  dayIndex: number;
  day: string;
  task: string;
  priority: ChecklistPriority;
  done: boolean;
}

export interface OperationsPlan {
  weeklyChecklist: ChecklistItem[];
  incompleteCount: number;
  remindersSent: number;
  prioritySummary: string;
}

export interface WeeklyChecklistRebuild {
  periodLabel: string;
  weeklyChecklist: ChecklistItem[];
  basedOnContentIdeas: number;
}

export interface MonthlyOperationsRecap {
  periodLabel: string;
  daysAggregated: number;
  totalRemindersSent: number;
  avgIncompletePerDay: number;
  note: string;
}
