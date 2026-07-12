import { generateId, type AIReport } from "@mkh/shared";
import type { ContentChecklistItem, ContentType, DailyContentPlan, MonthlyOperationsRecap } from "./types";

export const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const CONTENT_TYPES: ContentType[] = ["reel", "carousel", "video", "single_image", "story"];

/** Prefer ideas Content Planner's own memory hasn't used recently; falls back to reuse when Marketing Intelligence hasn't surfaced enough fresh ones — 7 slots to fill is normal, 2-3 raw ideas from research is normal too. */
export function pickThemesForWeek(contentIdeas: string[], recentlyUsedTitles: Set<string>): { theme: string; isFresh: boolean }[] {
  const fresh = contentIdeas.filter((idea) => !recentlyUsedTitles.has(idea));
  const pool = fresh.length > 0 ? fresh : contentIdeas;
  const isFreshPool = fresh.length > 0;

  return DAYS.map((_, i) => {
    if (pool.length === 0) {
      return { theme: `Konten umum minggu ini (belum ada ide baru dari riset)`, isFresh: false };
    }
    return { theme: pool[i % pool.length]!, isFresh: isFreshPool && fresh.includes(pool[i % pool.length]!) };
  });
}

function hookFor(theme: string): string {
  return `Buka dengan pertanyaan atau visual kuat tentang "${theme}" — target 2 detik pertama menahan scroll.`;
}

function ctaFor(contentType: ContentType): string {
  return contentType === "video" || contentType === "reel"
    ? "Komen 'INFO' untuk brosur & simulasi cicilan gratis."
    : "DM kami atau klik link di bio untuk jadwalkan kunjungan lokasi.";
}

function captionFor(theme: string, cta: string): string {
  return `${theme} — cek detailnya di sini! ${cta}`;
}

function deadlineFor(dayIndex: number): string {
  const today = new Date();
  const currentDayIndex = (today.getDay() + 6) % 7; // 0=Senin..6=Minggu
  const daysUntil = dayIndex - currentDayIndex;
  const deadline = new Date(today.getTime() + daysUntil * 86_400_000);
  return deadline.toISOString().slice(0, 10);
}

export function buildChecklist(
  themes: { theme: string; isFresh: boolean }[],
  completedDayIndexes: number[],
): ContentChecklistItem[] {
  return DAYS.map((day, dayIndex) => {
    const { theme } = themes[dayIndex] ?? { theme: "Konten umum" };
    const contentType = CONTENT_TYPES[dayIndex % CONTENT_TYPES.length]!;
    const hook = hookFor(theme);
    const cta = ctaFor(contentType);
    return {
      id: generateId("chk"),
      dayIndex,
      day,
      title: theme,
      contentType,
      hook,
      cta,
      caption: captionFor(theme, cta),
      deadline: deadlineFor(dayIndex),
      status: completedDayIndexes.includes(dayIndex) ? "done" : "not_started",
      priority: dayIndex < 2 ? "high" : dayIndex < 5 ? "medium" : "low",
    };
  });
}

/** Flags checklist items for days up to and including "today" that are still not done — those are genuinely overdue, not just future work. */
export function findOverdueItems(checklist: ContentChecklistItem[], todayDayIndex: number): ContentChecklistItem[] {
  return checklist.filter((item) => item.dayIndex <= todayDayIndex && item.status !== "done");
}

export function buildPrioritySummary(overdue: ContentChecklistItem[]): string {
  if (overdue.length === 0) return "Semua konten checklist sampai hari ini sudah selesai.";
  const highPriority = overdue.filter((i) => i.priority === "high");
  if (highPriority.length > 0) {
    return `${overdue.length} konten belum selesai, ${highPriority.length} di antaranya prioritas tinggi: ${highPriority.map((i) => i.day).join(", ")}.`;
  }
  return `${overdue.length} konten belum selesai: ${overdue.map((i) => i.day).join(", ")}.`;
}

export function buildDailyContentPlan(
  checklist: ContentChecklistItem[],
  todayDayIndex: number,
  remindersSent: number,
  freshThemeCount: number,
): DailyContentPlan {
  const overdue = findOverdueItems(checklist, todayDayIndex);
  return {
    checklist,
    incompleteCount: overdue.length,
    remindersSent,
    prioritySummary: buildPrioritySummary(overdue),
    freshThemeCount,
  };
}

export function buildMonthlyRecap(periodLabel: string, dailyReports: AIReport<DailyContentPlan>[]): MonthlyOperationsRecap {
  const totalRemindersSent = dailyReports.reduce((sum, r) => sum + (r.data?.remindersSent ?? 0), 0);
  const avgIncompletePerDay =
    dailyReports.length > 0
      ? Number((dailyReports.reduce((sum, r) => sum + (r.data?.incompleteCount ?? 0), 0) / dailyReports.length).toFixed(1))
      : 0;
  const note =
    dailyReports.length === 0
      ? "Belum ada laporan harian bulan ini untuk direkap."
      : avgIncompletePerDay > 2
        ? `Rata-rata ${avgIncompletePerDay} konten tertunda per hari — checklist perlu ditinjau ulang bersama Markom.`
        : `Rata-rata ${avgIncompletePerDay} konten tertunda per hari — cukup terkendali.`;

  return { periodLabel, daysAggregated: dailyReports.length, totalRemindersSent, avgIncompletePerDay, note };
}
