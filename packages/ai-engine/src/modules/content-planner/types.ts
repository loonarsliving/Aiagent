export type ContentType = "reel" | "carousel" | "single_image" | "video" | "story";
export type ChecklistStatus = "not_started" | "in_progress" | "done";
export type ChecklistPriority = "high" | "medium" | "low";

/** One row of the daily Markom checklist — every field the brief requires. */
export interface ContentChecklistItem {
  id: string;
  dayIndex: number;
  day: string;
  title: string;
  contentType: ContentType;
  hook: string;
  cta: string;
  caption: string;
  deadline: string;
  status: ChecklistStatus;
  priority: ChecklistPriority;
}

export interface DailyContentPlan {
  checklist: ContentChecklistItem[];
  incompleteCount: number;
  remindersSent: number;
  prioritySummary: string;
  /** How many of today's items used a theme Content Planner's own memory hadn't seen recently — 0 means it had to reuse ideas because Marketing Intelligence hasn't surfaced enough fresh ones. */
  freshThemeCount: number;
}

export interface WeeklyChecklistRebuild {
  periodLabel: string;
  checklist: ContentChecklistItem[];
  basedOnContentIdeas: number;
}

export interface MonthlyOperationsRecap {
  periodLabel: string;
  daysAggregated: number;
  totalRemindersSent: number;
  avgIncompletePerDay: number;
  note: string;
}
