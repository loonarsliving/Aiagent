import type { AIReport } from "@mkh/shared";
import type { ChecklistItem, OperationsPlan } from "./types";

export const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

/** Turns Marketing Intelligence's raw content ideas into a day-by-day assigned checklist, marked against the current completion state. */
export function buildWeeklyChecklist(contentIdeas: string[], completedDayIndexes: number[]): ChecklistItem[] {
  return DAYS.map((day, dayIndex) => {
    const idea = contentIdeas.length > 0 ? contentIdeas[dayIndex % contentIdeas.length] : undefined;
    return {
      dayIndex,
      day,
      task: idea ? `Publish konten — tema "${idea}"` : "Review & jadwalkan ulang konten (belum ada ide baru dari riset)",
      priority: dayIndex < 2 ? "high" : dayIndex < 5 ? "medium" : "low",
      done: completedDayIndexes.includes(dayIndex),
    };
  });
}

/** Flags checklist items for days up to and including "today" that are still not done — those are genuinely overdue, not just future work. */
export function findOverdueItems(checklist: ChecklistItem[], todayDayIndex: number): ChecklistItem[] {
  return checklist.filter((item) => item.dayIndex <= todayDayIndex && !item.done);
}

export function buildPrioritySummary(overdue: ChecklistItem[]): string {
  if (overdue.length === 0) return "Semua tugas checklist sampai hari ini sudah selesai.";
  const highPriority = overdue.filter((i) => i.priority === "high");
  if (highPriority.length > 0) {
    return `${overdue.length} tugas belum selesai, ${highPriority.length} di antaranya prioritas tinggi: ${highPriority.map((i) => i.day).join(", ")}.`;
  }
  return `${overdue.length} tugas belum selesai: ${overdue.map((i) => i.day).join(", ")}.`;
}

export function buildOperationsPlan(checklist: ChecklistItem[], todayDayIndex: number, remindersSent: number): OperationsPlan {
  const overdue = findOverdueItems(checklist, todayDayIndex);
  return {
    weeklyChecklist: checklist,
    incompleteCount: overdue.length,
    remindersSent,
    prioritySummary: buildPrioritySummary(overdue),
  };
}

export function buildMonthlyRecap(periodLabel: string, dailyReports: AIReport<OperationsPlan>[]) {
  const totalRemindersSent = dailyReports.reduce((sum, r) => sum + (r.data?.remindersSent ?? 0), 0);
  const avgIncompletePerDay =
    dailyReports.length > 0
      ? Number((dailyReports.reduce((sum, r) => sum + (r.data?.incompleteCount ?? 0), 0) / dailyReports.length).toFixed(1))
      : 0;
  const note =
    dailyReports.length === 0
      ? "Belum ada laporan harian bulan ini untuk direkap."
      : avgIncompletePerDay > 2
        ? `Rata-rata ${avgIncompletePerDay} tugas tertunda per hari — checklist perlu ditinjau ulang bersama Markom.`
        : `Rata-rata ${avgIncompletePerDay} tugas tertunda per hari — cukup terkendali.`;

  return { periodLabel, daysAggregated: dailyReports.length, totalRemindersSent, avgIncompletePerDay, note };
}
