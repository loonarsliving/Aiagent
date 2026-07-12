import { generateId, type AIReport, type AIRunContext, type EmployeeSOP } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { notify } from "@mkh/notifications";
import { KnowledgeBase } from "@mkh/memory";
import type { AIEmployee } from "../../core/ai-employee";
import type { WorkLogger } from "../../core/work-logger";
import { aggregateRecentReports } from "../../core/aggregate-reports";
import type { DailyResearchSummary } from "../marketing-intelligence/types";
import { buildChecklist, buildDailyContentPlan, buildMonthlyRecap, findOverdueItems, pickThemesForWeek } from "./logic";
import type { DailyContentPlan, MonthlyOperationsRecap, WeeklyChecklistRebuild } from "./types";

const MODULE_ID = "content-planner" as const;

const sop: EmployeeSOP = {
  daily: [
    { id: "start", offsetMinutes: 0, label: "Mulai bekerja" },
    { id: "read_intelligence", offsetMinutes: 5, label: "Membaca laporan Marketing Intelligence terbaru" },
    { id: "recall_memory", offsetMinutes: 10, label: "Mengecek tema konten yang sudah pernah dipakai" },
    { id: "checklist", offsetMinutes: 15, label: "Menyusun content plan & checklist harian Markom" },
    { id: "memory_save", offsetMinutes: 20, label: "Menyimpan tema konten ke memory" },
    { id: "reminders", offsetMinutes: 25, label: "Mengirim reminder untuk konten belum selesai" },
    { id: "report", offsetMinutes: 30, label: "Mengirim laporan content plan harian" },
  ],
  weekly: [
    { id: "start", offsetMinutes: 0, label: "Mulai membangun ulang checklist mingguan" },
    { id: "rebuild", offsetMinutes: 10, label: "Menyusun checklist baru dari ide konten terbaru" },
  ],
  monthly: [
    { id: "start", offsetMinutes: 0, label: "Mulai rekap bulanan" },
    { id: "aggregate", offsetMinutes: 10, label: "Mengumpulkan laporan harian sebulan terakhir" },
    { id: "recap", offsetMinutes: 20, label: "Menyusun rekap tingkat penyelesaian Markom" },
  ],
};

/** JS Date#getDay() is 0=Sunday..6=Saturday; the checklist is 0=Senin..6=Minggu. */
function todayDayIndex(): number {
  return (new Date().getDay() + 6) % 7;
}

async function getLatestContentIdeas(): Promise<string[]> {
  const report = await getRepository().getLatestReport("marketing-intelligence");
  if (!report || report.status !== "success") return [];
  return (report.data as DailyResearchSummary).contentChecklist ?? [];
}

async function runDaily(_context: AIRunContext, log: WorkLogger): Promise<AIReport<DailyContentPlan>> {
  await log.step("read_intelligence", "Membaca laporan Marketing Intelligence terbaru");
  const contentIdeas = await getLatestContentIdeas();

  await log.step("recall_memory", "Mengecek tema konten yang sudah pernah dipakai");
  const kb = new KnowledgeBase(getRepository());
  const recentlyUsed = await kb.recall(MODULE_ID, "content-theme-used", 50);
  const recentlyUsedTitles = new Set(recentlyUsed.map((i) => i.title));

  await log.step("checklist", "Menyusun content plan & checklist harian Markom");
  const themes = pickThemesForWeek(contentIdeas, recentlyUsedTitles);
  const completion = await getRepository().getMarkomChecklistCompletionState();
  const checklist = buildChecklist(themes, completion.completedDayIndexes);

  const freshThemeCount = themes.filter((t) => t.isFresh).length;
  const rememberResults = await kb.remember(
    checklist.map((item) => ({
      id: `${MODULE_ID}:content-theme-used:${item.title}`,
      moduleId: MODULE_ID,
      category: "content-theme-used",
      title: item.title,
      metadata: { contentType: item.contentType },
    })),
  );
  await log.step("memory_save", `${rememberResults.length} tema konten disimpan ke memory`);

  const today = todayDayIndex();
  const overdue = findOverdueItems(checklist, today);

  let remindersSent = 0;
  if (overdue.length > 0) {
    await notify({
      title: `${overdue.length} konten checklist belum selesai`,
      body: `Markom belum menyelesaikan: ${overdue.map((i) => `${i.day} (${i.title})`).join("; ")}.`,
      severity: overdue.some((i) => i.priority === "high") ? "warning" : "info",
      target: "markom",
      sourceModuleId: MODULE_ID,
    });
    remindersSent = overdue.length;
    await log.step("reminders", `Reminder dikirim untuk ${overdue.length} konten tertunda`);
  } else {
    await log.step("reminders", "Tidak ada konten tertunda, tidak perlu reminder");
  }

  const data = buildDailyContentPlan(checklist, today, remindersSent, freshThemeCount);

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "daily",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: data.prioritySummary,
    data,
  };
}

async function runWeekly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<WeeklyChecklistRebuild>> {
  await log.step("rebuild", "Menyusun checklist baru untuk minggu ini");
  const contentIdeas = await getLatestContentIdeas();
  const kb = new KnowledgeBase(getRepository());
  const recentlyUsed = await kb.recall(MODULE_ID, "content-theme-used", 50);
  const themes = pickThemesForWeek(contentIdeas, new Set(recentlyUsed.map((i) => i.title)));
  const checklist = buildChecklist(themes, []);

  const data: WeeklyChecklistRebuild = {
    periodLabel: "Minggu ini",
    checklist,
    basedOnContentIdeas: contentIdeas.length,
  };

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "weekly",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: `Checklist baru disusun dari ${contentIdeas.length} ide konten hasil riset.`,
    data,
  };
}

async function runMonthly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<MonthlyOperationsRecap>> {
  await log.step("aggregate", "Mengumpulkan laporan harian sebulan terakhir");
  const dailyReports = await aggregateRecentReports<DailyContentPlan>(MODULE_ID, 30);
  const data = buildMonthlyRecap("Bulan ini", dailyReports);
  await log.step("recap", "Rekap bulanan disusun");

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "monthly",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: data.note,
    data,
  };
}

export const contentPlannerEmployee: AIEmployee<DailyContentPlan | WeeklyChecklistRebuild | MonthlyOperationsRecap> = {
  id: MODULE_ID,
  name: "Content Planner AI",
  role: "Perencana Konten",
  description:
    "Membaca hasil Marketing Intelligence, menyusun content plan & checklist harian Markom (judul, jenis konten, hook, CTA, caption, deadline, status), dan mengirim reminder lewat Notification Coordinator. Memory sendiri melacak tema yang sudah pernah dipakai.",
  sop,
  runDaily,
  runWeekly,
  runMonthly,
};
