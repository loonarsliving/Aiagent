import { generateId, type AIReport, type AIRunContext, type EmployeeSOP } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { notify } from "@mkh/notifications";
import type { AIEmployee } from "../../core/ai-employee";
import type { WorkLogger } from "../../core/work-logger";
import { aggregateRecentReports } from "../../core/aggregate-reports";
import type { DailyResearchSummary } from "../marketing-intelligence/types";
import { buildMonthlyRecap, buildOperationsPlan, buildWeeklyChecklist, findOverdueItems } from "./logic";
import type { MonthlyOperationsRecap, OperationsPlan, WeeklyChecklistRebuild } from "./types";

const MODULE_ID = "marketing-operation" as const;

const sop: EmployeeSOP = {
  daily: [
    { id: "start", offsetMinutes: 0, label: "Mulai bekerja" },
    { id: "read_intelligence", offsetMinutes: 5, label: "Membaca laporan Marketing Intelligence terbaru" },
    { id: "checklist", offsetMinutes: 15, label: "Menyusun/memperbarui checklist mingguan" },
    { id: "reminders", offsetMinutes: 25, label: "Mengirim reminder untuk tugas belum selesai" },
    { id: "report", offsetMinutes: 30, label: "Mengirim laporan operasional" },
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

async function runDaily(_context: AIRunContext, log: WorkLogger): Promise<AIReport<OperationsPlan>> {
  await log.step("read_intelligence", "Membaca laporan Marketing Intelligence terbaru");
  const contentIdeas = await getLatestContentIdeas();

  await log.step("checklist", "Menyusun checklist mingguan");
  const completion = await getRepository().getMarkomChecklistCompletionState();
  const checklist = buildWeeklyChecklist(contentIdeas, completion.completedDayIndexes);

  const today = todayDayIndex();
  const overdue = findOverdueItems(checklist, today);

  let remindersSent = 0;
  if (overdue.length > 0) {
    await notify({
      title: `${overdue.length} tugas checklist konten belum selesai`,
      body: `Markom belum menyelesaikan: ${overdue.map((i) => `${i.day} (${i.task})`).join("; ")}.`,
      severity: overdue.some((i) => i.priority === "high") ? "warning" : "info",
      target: "markom",
      sourceModuleId: MODULE_ID,
    });
    remindersSent = overdue.length;
    await log.step("reminders", `Reminder dikirim untuk ${overdue.length} tugas tertunda`);
  } else {
    await log.step("reminders", "Tidak ada tugas tertunda, tidak perlu reminder");
  }

  const data = buildOperationsPlan(checklist, today, remindersSent);

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
  const checklist = buildWeeklyChecklist(contentIdeas, []);

  const data: WeeklyChecklistRebuild = {
    periodLabel: "Minggu ini",
    weeklyChecklist: checklist,
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
  const dailyReports = await aggregateRecentReports<OperationsPlan>(MODULE_ID, 30);
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

export const marketingOperationEmployee: AIEmployee<OperationsPlan | WeeklyChecklistRebuild | MonthlyOperationsRecap> = {
  id: MODULE_ID,
  name: "Marketing Operation AI",
  role: "Koordinator Operasional Markom",
  description:
    "Membaca hasil Marketing Intelligence, menyusun checklist mingguan Markom, menentukan prioritas, dan mengirim reminder untuk tugas yang belum selesai lewat Notification Engine.",
  sop,
  runDaily,
  runWeekly,
  runMonthly,
};
