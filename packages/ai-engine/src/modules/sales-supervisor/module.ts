import { generateId, type AIReport, type AIRunContext, type EmployeeSOP } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { notify } from "@mkh/notifications";
import { KnowledgeBase } from "@mkh/memory";
import type { AIEmployee } from "../../core/ai-employee";
import type { WorkLogger } from "../../core/work-logger";
import { aggregateRecentReports } from "../../core/aggregate-reports";
import { buildMonthlyTargetRecap, buildSupervisionData, buildWeeklyPaceCheck } from "./logic";
import type { MonthlyTargetRecap, SalesSupervisionData, WeeklyPaceCheck } from "./types";

const MODULE_ID = "sales-supervisor" as const;

const sop: EmployeeSOP = {
  daily: [
    { id: "start", offsetMinutes: 0, label: "Mulai bekerja" },
    { id: "read_sales_data", offsetMinutes: 5, label: "Membaca data sales" },
    { id: "compute_progress", offsetMinutes: 10, label: "Menghitung target vs progress" },
    { id: "build_strategy", offsetMinutes: 15, label: "Menyusun strategi pemulihan/scaling per rep" },
    { id: "memory_save", offsetMinutes: 18, label: "Menyimpan riwayat follow-up ke memory" },
    { id: "notify", offsetMinutes: 20, label: "Mengirim notifikasi ke Dir Ops jika ada yang perlu perhatian" },
    { id: "report", offsetMinutes: 25, label: "Mengirim laporan harian" },
  ],
  weekly: [
    { id: "start", offsetMinutes: 0, label: "Mulai pengecekan pace mingguan" },
    { id: "aggregate", offsetMinutes: 10, label: "Mengumpulkan laporan harian seminggu terakhir" },
    { id: "pace_check", offsetMinutes: 20, label: "Menilai tren progress & sales yang kronis tertinggal" },
  ],
  monthly: [
    { id: "start", offsetMinutes: 0, label: "Mulai rekap target bulanan" },
    { id: "aggregate", offsetMinutes: 10, label: "Mengumpulkan laporan harian sebulan terakhir" },
    { id: "recap", offsetMinutes: 20, label: "Menyusun rekap target bulanan" },
  ],
};

/** Read-only supervisor — never writes sales data, only observes and recommends. */
async function runDaily(_context: AIRunContext, log: WorkLogger): Promise<AIReport<SalesSupervisionData>> {
  await log.step("read_sales_data", "Membaca data sales");
  const snapshot = await getRepository().getSalesSnapshot();

  await log.step("compute_progress", "Menghitung target vs progress");
  const data = buildSupervisionData(snapshot.periodLabel, snapshot.reps);

  const needsStrategy = data.reps.filter((r) => r.strategyType !== "none");
  await log.step("build_strategy", `${needsStrategy.length} rep butuh strategi (recovery/scaling)`);

  const kb = new KnowledgeBase(getRepository());
  await kb.remember(
    needsStrategy.map((r) => ({
      id: `${MODULE_ID}:rep-follow-up-history:${r.repId}`,
      moduleId: MODULE_ID,
      category: "rep-follow-up-history",
      title: r.name,
      metadata: { strategyType: r.strategyType, branch: r.branch, progressPct: r.progressPct },
    })),
  );
  await log.step("memory_save", `Riwayat follow-up disimpan untuk ${needsStrategy.length} rep`);

  if (data.laggingReps.length > 0) {
    const names = data.laggingReps.map((r) => `${r.name} (${r.branch})`).join(", ");
    await notify({
      title: `${data.laggingReps.length} sales tertinggal dari target`,
      body: `Sales berikut perlu perhatian Dir Ops: ${names}.`,
      severity: "warning",
      target: "dir_ops",
      sourceModuleId: MODULE_ID,
    });
    await log.step("notify", "Notifikasi dikirim ke Dir Ops");
  } else {
    await log.step("notify", "Tidak ada sales tertinggal, tidak perlu notifikasi");
  }

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "daily",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: `Progress keseluruhan ${data.overallProgressPct}% (${data.periodLabel}), ${data.laggingReps.length} dari ${data.reps.length} sales tertinggal.`,
    data,
  };
}

async function runWeekly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<WeeklyPaceCheck>> {
  await log.step("aggregate", "Mengumpulkan laporan harian 7 hari terakhir");
  const dailyReports = await aggregateRecentReports<SalesSupervisionData>(MODULE_ID, 7);
  const data = buildWeeklyPaceCheck("7 hari terakhir", dailyReports);
  await log.step("pace_check", `Tren progress: ${data.progressTrend}`);

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "weekly",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: `Rata-rata progress ${data.avgOverallProgressPct}%, tren ${data.progressTrend}${data.chronicLaggards.length > 0 ? `, sales kronis tertinggal: ${data.chronicLaggards.join(", ")}` : ""}.`,
    data,
  };
}

async function runMonthly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<MonthlyTargetRecap>> {
  await log.step("aggregate", "Mengumpulkan laporan harian sebulan terakhir");
  const dailyReports = await aggregateRecentReports<SalesSupervisionData>(MODULE_ID, 30);
  const data = buildMonthlyTargetRecap("Bulan ini", dailyReports);
  await log.step("recap", "Rekap target bulanan disusun");

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

export const salesSupervisorEmployee: AIEmployee<SalesSupervisionData | WeeklyPaceCheck | MonthlyTargetRecap> = {
  id: MODULE_ID,
  name: "Sales Supervisor AI",
  role: "Pengawas Penjualan",
  description:
    "Mengecek target, progress, follow-up, dan closing setiap sales. Jika jauh dari target, menyusun strategi pemulihan; jika hampir mencapai target, menyusun strategi scaling. Memory sendiri melacak riwayat rep yang butuh perhatian. Read-only — tidak pernah mengubah data sales.",
  sop,
  runDaily,
  runWeekly,
  runMonthly,
};
