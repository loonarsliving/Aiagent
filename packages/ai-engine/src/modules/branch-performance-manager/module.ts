import { generateId, type AIReport, type AIRunContext, type EmployeeSOP } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { notify } from "@mkh/notifications";
import { KnowledgeBase } from "@mkh/memory";
import type { AIEmployee } from "../../core/ai-employee";
import type { WorkLogger } from "../../core/work-logger";
import { aggregateRecentReports } from "../../core/aggregate-reports";
import { runReasoning } from "../../reasoning";
import { buildBranchPerformanceData, buildMonthlyBranchRecap, buildWeeklyBranchTrend } from "./logic";
import type { BranchPerformanceData, MonthlyBranchRecap, WeeklyBranchTrend } from "./types";

const MODULE_ID = "branch-performance-manager" as const;

const sop: EmployeeSOP = {
  daily: [
    { id: "start", offsetMinutes: 0, label: "Mulai bekerja" },
    { id: "read_sales_data", offsetMinutes: 5, label: "Membaca target, progress, dan aktivitas per cabang" },
    { id: "group_by_branch", offsetMinutes: 8, label: "Mengelompokkan data per cabang" },
    { id: "classify_branches", offsetMinutes: 12, label: "Mengklasifikasikan status setiap cabang" },
    { id: "build_recommendations", offsetMinutes: 16, label: "Menyusun rekomendasi untuk Kepala Cabang" },
    { id: "memory_save", offsetMinutes: 18, label: "Menyimpan riwayat rekomendasi ke memory" },
    { id: "notify", offsetMinutes: 20, label: "Mengirim notifikasi untuk cabang yang butuh perhatian" },
    { id: "report", offsetMinutes: 25, label: "Mengirim laporan harian" },
    { id: "ai_reasoning", offsetMinutes: 27, label: "AI melakukan reasoning (Gemini) & menyusun rekomendasi" },
  ],
  weekly: [
    { id: "start", offsetMinutes: 0, label: "Mulai analisa tren mingguan per cabang" },
    { id: "aggregate", offsetMinutes: 10, label: "Mengumpulkan laporan harian seminggu terakhir" },
    { id: "trend_check", offsetMinutes: 20, label: "Menilai tren performa tiap cabang" },
  ],
  monthly: [
    { id: "start", offsetMinutes: 0, label: "Mulai rekap performa cabang bulanan" },
    { id: "aggregate", offsetMinutes: 10, label: "Mengumpulkan laporan harian sebulan terakhir" },
    { id: "recap", offsetMinutes: 20, label: "Menyusun rekap performa cabang bulanan" },
  ],
};

/** Read-only — setiap cabang punya bagian sendiri di laporan, ditentukan murni dari data, bukan hardcode. */
async function runDaily(_context: AIRunContext, log: WorkLogger): Promise<AIReport<BranchPerformanceData>> {
  await log.step("read_sales_data", "Membaca target, progress, dan aktivitas per cabang");
  const snapshot = await getRepository().getSalesSnapshot();

  await log.step("group_by_branch", "Mengelompokkan data per cabang");
  await log.step("classify_branches", "Mengklasifikasikan status setiap cabang");
  const data = buildBranchPerformanceData(snapshot.periodLabel, snapshot.reps);

  await log.step("build_recommendations", `Rekomendasi disusun untuk ${data.branches.length} cabang`);

  const kb = new KnowledgeBase(getRepository());
  await kb.remember(
    data.branches.map((b) => ({
      id: `${MODULE_ID}:branch-recommendation-history:${b.branch}`,
      moduleId: MODULE_ID,
      category: "branch-recommendation-history",
      title: b.branch,
      metadata: { status: b.status, progressPct: b.progressPct },
    })),
  );
  await log.step("memory_save", `Riwayat rekomendasi disimpan untuk ${data.branches.length} cabang`);

  if (data.branchesNeedingAttention.length > 0) {
    await notify({
      title: `${data.branchesNeedingAttention.length} cabang butuh perhatian`,
      body: `Cabang berikut perlu tindak lanjut Kepala Cabang: ${data.branchesNeedingAttention.join(", ")}.`,
      severity: "warning",
      target: "dir_ops",
      sourceModuleId: MODULE_ID,
    });
    await log.step("notify", "Notifikasi dikirim untuk cabang yang butuh perhatian");
  } else {
    await log.step("notify", "Semua cabang sehat, tidak perlu notifikasi");
  }

  const summary = `${data.branches.length} cabang dianalisa (${data.periodLabel}), ${data.branchesNeedingAttention.length} butuh perhatian.`;
  const aiReasoning = await runReasoning(
    {
      moduleId: MODULE_ID,
      observation: summary,
      contextData: {
        branchesNeedingAttention: data.branchesNeedingAttention,
        totalBranches: data.branches.length,
      },
    },
    log,
  );

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "daily",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary,
    data,
    aiReasoning,
  };
}

async function runWeekly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<WeeklyBranchTrend>> {
  await log.step("aggregate", "Mengumpulkan laporan harian 7 hari terakhir");
  const dailyReports = await aggregateRecentReports<BranchPerformanceData>(MODULE_ID, 7);
  const data = buildWeeklyBranchTrend("7 hari terakhir", dailyReports);
  await log.step("trend_check", `Tren performa dihitung untuk ${data.branchTrends.length} cabang`);

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "weekly",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: `Tren mingguan disusun untuk ${data.branchTrends.length} cabang dari ${data.daysAggregated} laporan harian.`,
    data,
  };
}

async function runMonthly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<MonthlyBranchRecap>> {
  await log.step("aggregate", "Mengumpulkan laporan harian sebulan terakhir");
  const dailyReports = await aggregateRecentReports<BranchPerformanceData>(MODULE_ID, 30);
  const data = buildMonthlyBranchRecap("Bulan ini", dailyReports);
  await log.step("recap", "Rekap performa cabang bulanan disusun");

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

export const branchPerformanceManagerEmployee: AIEmployee<BranchPerformanceData | WeeklyBranchTrend | MonthlyBranchRecap> = {
  id: MODULE_ID,
  name: "Branch Performance Manager AI",
  role: "Manajer Performa Cabang",
  description:
    "Membaca target, progress, dan aktivitas setiap cabang, lalu membuat rekomendasi ke Kepala Cabang masing-masing. Setiap cabang otomatis mendapat bagian sendiri di laporan — murni data-driven, tidak ada cabang yang di-hardcode. Read-only, memory sendiri melacak riwayat rekomendasi per cabang.",
  sop,
  runDaily,
  runWeekly,
  runMonthly,
};
