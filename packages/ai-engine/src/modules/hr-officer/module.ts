import { generateId, type AIReport, type AIRunContext, type EmployeeSOP } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { notify } from "@mkh/notifications";
import { KnowledgeBase } from "@mkh/memory";
import type { AIEmployee } from "../../core/ai-employee";
import type { WorkLogger } from "../../core/work-logger";
import { aggregateRecentReports } from "../../core/aggregate-reports";
import { buildHRAnalysis, buildMonthlyHRRecap, buildWeeklyHRTrend } from "./logic";
import type { HRAnalysisData, MonthlyHRRecap, WeeklyHRTrend } from "./types";

const MODULE_ID = "hr-officer" as const;

const sop: EmployeeSOP = {
  daily: [
    { id: "start", offsetMinutes: 0, label: "Mulai bekerja" },
    { id: "read_attendance", offsetMinutes: 5, label: "Membaca absensi, keterlambatan, cuti, dan KPI" },
    { id: "flag_issues", offsetMinutes: 10, label: "Menandai staff dengan isu (absensi/keterlambatan/cuti/KPI)" },
    { id: "coaching_recommendation", offsetMinutes: 14, label: "Menyusun rekomendasi coaching" },
    { id: "memory_save", offsetMinutes: 17, label: "Menyimpan riwayat flag ke memory" },
    { id: "notify", offsetMinutes: 20, label: "Mengirim peringatan ke HR/Owner jika ada staff yang perlu perhatian" },
    { id: "report", offsetMinutes: 25, label: "Mengirim laporan harian" },
  ],
  weekly: [
    { id: "start", offsetMinutes: 0, label: "Mulai analisa tren mingguan HR" },
    { id: "aggregate", offsetMinutes: 10, label: "Mengumpulkan laporan harian seminggu terakhir" },
    { id: "trend_check", offsetMinutes: 20, label: "Menilai staff dengan isu kronis" },
  ],
  monthly: [
    { id: "start", offsetMinutes: 0, label: "Mulai rekap HR bulanan" },
    { id: "aggregate", offsetMinutes: 10, label: "Mengumpulkan laporan harian sebulan terakhir" },
    { id: "recap", offsetMinutes: 20, label: "Menyusun rekap HR bulanan" },
  ],
};

/** Read-only — memantau, tidak pernah mengubah data absensi/cuti/KPI. */
async function runDaily(_context: AIRunContext, log: WorkLogger): Promise<AIReport<HRAnalysisData>> {
  await log.step("read_attendance", "Membaca absensi, keterlambatan, cuti, dan KPI");
  const snapshot = await getRepository().getHRSnapshot();

  await log.step("flag_issues", "Menandai staff dengan isu");
  const data = buildHRAnalysis(snapshot.periodLabel, snapshot.workingDaysInPeriod, snapshot.staff);
  await log.step("coaching_recommendation", `${data.flaggedStaff.length} staff mendapat rekomendasi coaching`);

  const kb = new KnowledgeBase(getRepository());
  await kb.remember(
    data.flaggedStaff.map((f) => ({
      id: `${MODULE_ID}:staff-flag-history:${f.staffId}`,
      moduleId: MODULE_ID,
      category: "staff-flag-history",
      title: f.name,
      metadata: { issues: f.issues, branch: f.branch, kpiScore: f.kpiScore },
    })),
  );
  await log.step("memory_save", `Riwayat flag disimpan untuk ${data.flaggedStaff.length} staff`);

  if (data.flaggedStaff.length > 0) {
    const names = data.flaggedStaff.map((f) => `${f.name} (${f.branch})`).join(", ");
    await notify({
      title: `${data.flaggedStaff.length} staff perlu perhatian HR`,
      body: `Staff berikut perlu coaching/tindak lanjut: ${names}.`,
      severity: "warning",
      target: "hr",
      sourceModuleId: MODULE_ID,
    });
    await log.step("notify", "Notifikasi dikirim ke HR/Owner");
  } else {
    await log.step("notify", "Tidak ada staff yang perlu perhatian, tidak perlu notifikasi");
  }

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "daily",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: `${data.totalStaff} staff dianalisa (${data.periodLabel}), rata-rata KPI ${data.avgKpiScore}, ${data.flaggedStaff.length} staff perlu perhatian.`,
    data,
  };
}

async function runWeekly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<WeeklyHRTrend>> {
  await log.step("aggregate", "Mengumpulkan laporan harian 7 hari terakhir");
  const dailyReports = await aggregateRecentReports<HRAnalysisData>(MODULE_ID, 7);
  const data = buildWeeklyHRTrend("7 hari terakhir", dailyReports);
  await log.step("trend_check", `${data.chronicIssueStaff.length} staff dengan isu kronis`);

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "weekly",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: `Rata-rata ${data.avgFlaggedCount} staff perlu perhatian per hari minggu ini${data.chronicIssueStaff.length > 0 ? `, isu kronis: ${data.chronicIssueStaff.join(", ")}` : ""}.`,
    data,
  };
}

async function runMonthly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<MonthlyHRRecap>> {
  await log.step("aggregate", "Mengumpulkan laporan harian sebulan terakhir");
  const dailyReports = await aggregateRecentReports<HRAnalysisData>(MODULE_ID, 30);
  const data = buildMonthlyHRRecap("Bulan ini", dailyReports);
  await log.step("recap", "Rekap HR bulanan disusun");

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

export const hrOfficerEmployee: AIEmployee<HRAnalysisData | WeeklyHRTrend | MonthlyHRRecap> = {
  id: MODULE_ID,
  name: "HR Officer AI",
  role: "Petugas HR",
  description:
    "Memonitor absensi, keterlambatan, cuti, dan KPI seluruh staff. Memberi peringatan dan rekomendasi coaching untuk staff yang butuh perhatian. Memory sendiri melacak riwayat flag per staff. Read-only — tidak pernah mengubah data absensi/cuti/KPI.",
  sop,
  runDaily,
  runWeekly,
  runMonthly,
};
