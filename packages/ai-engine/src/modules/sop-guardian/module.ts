import { AI_MODULE_IDS, generateId, type AIReport, type AIRunContext, type EmployeeSOP } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { notify } from "@mkh/notifications";
import { KnowledgeBase } from "@mkh/memory";
import type { AIEmployee } from "../../core/ai-employee";
import type { WorkLogger } from "../../core/work-logger";
import { aggregateRecentReports } from "../../core/aggregate-reports";
import { runReasoning } from "../../reasoning";
import { buildMonthlySOPRecap, buildSOPComplianceData, buildWeeklySOPTrend, extractLatestRunSteps, type ModuleCheckInput } from "./logic";
import type { MonthlySOPRecap, SOPComplianceData, WeeklySOPTrend } from "./types";

const MODULE_ID = "sop-guardian" as const;

/**
 * Every other employee — SOP Guardian watches the whole company, not a
 * hardcoded subset, so a newly added employee is automatically covered
 * the moment it's added to AI_MODULE_IDS.
 */
const WATCHED_MODULE_IDS = AI_MODULE_IDS.filter((id) => id !== MODULE_ID);

const sop: EmployeeSOP = {
  daily: [
    { id: "start", offsetMinutes: 0, label: "Mulai bekerja" },
    { id: "read_reports", offsetMinutes: 5, label: "Membaca laporan & work log seluruh AI lain" },
    { id: "check_compliance", offsetMinutes: 10, label: "Memeriksa missed run, run gagal, retry berlebih, dan struktur SOP" },
    { id: "memory_save", offsetMinutes: 13, label: "Menyimpan riwayat pelanggaran ke memory" },
    { id: "notify", offsetMinutes: 15, label: "Mengirim peringatan untuk setiap pelanggaran SOP" },
    { id: "report", offsetMinutes: 18, label: "Mengirim laporan kepatuhan SOP harian" },
    { id: "ai_reasoning", offsetMinutes: 20, label: "AI melakukan reasoning (Gemini) & menyusun rekomendasi" },
  ],
  weekly: [
    { id: "start", offsetMinutes: 0, label: "Mulai analisa tren kepatuhan mingguan" },
    { id: "aggregate", offsetMinutes: 10, label: "Mengumpulkan laporan harian seminggu terakhir" },
    { id: "trend_check", offsetMinutes: 20, label: "Menilai AI yang kronis melanggar SOP" },
  ],
  monthly: [
    { id: "start", offsetMinutes: 0, label: "Mulai rekap kepatuhan SOP bulanan" },
    { id: "aggregate", offsetMinutes: 10, label: "Mengumpulkan laporan harian sebulan terakhir" },
    { id: "recap", offsetMinutes: 20, label: "Menyusun rekap kepatuhan SOP bulanan" },
  ],
};

/** Read-only auditor — never modifies another employee's data, only observes reports + work log and warns. */
async function runDaily(_context: AIRunContext, log: WorkLogger): Promise<AIReport<SOPComplianceData>> {
  await log.step("read_reports", `Membaca laporan & work log ${WATCHED_MODULE_IDS.length} AI lain`);
  const repo = getRepository();
  const checks: ModuleCheckInput[] = await Promise.all(
    WATCHED_MODULE_IDS.map(async (moduleId) => {
      const [latestReport, recentWorkLog] = await Promise.all([
        repo.getLatestReport(moduleId),
        repo.listWorkLog({ moduleId }, 200),
      ]);
      return { moduleId, latestReport, latestRunSteps: extractLatestRunSteps(recentWorkLog) };
    }),
  );

  const data = buildSOPComplianceData("Hari ini", checks);
  await log.step("check_compliance", `${data.violations.length} pelanggaran ditemukan dari ${data.employeesChecked} AI`);

  const kb = new KnowledgeBase(repo);
  await kb.remember(
    data.violations.map((v) => ({
      id: `${MODULE_ID}:violation-history:${v.moduleId}:${v.violationType}`,
      moduleId: MODULE_ID,
      category: "violation-history",
      title: `${v.moduleId} — ${v.violationType}`,
      metadata: { violationType: v.violationType, detail: v.detail },
    })),
  );
  await log.step("memory_save", `Riwayat pelanggaran disimpan untuk ${data.violations.length} insiden`);

  if (data.violations.length > 0) {
    await notify({
      title: `${data.violations.length} pelanggaran SOP terdeteksi`,
      body: data.violations.map((v) => v.warning).join(" | "),
      severity: "warning",
      target: "dir_ops",
      sourceModuleId: MODULE_ID,
    });
    await log.step("notify", "Peringatan dikirim untuk setiap pelanggaran SOP");
  } else {
    await log.step("notify", "Semua AI patuh SOP hari ini, tidak perlu peringatan");
  }

  const summary = `${data.employeesChecked} AI diperiksa, ${data.violations.length} pelanggaran SOP ditemukan, ${data.compliantModuleIds.length} patuh penuh.`;
  const aiReasoning = await runReasoning(
    {
      moduleId: MODULE_ID,
      observation: summary,
      contextData: {
        violationCount: data.violations.length,
        employeesChecked: data.employeesChecked,
        compliantCount: data.compliantModuleIds.length,
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

async function runWeekly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<WeeklySOPTrend>> {
  await log.step("aggregate", "Mengumpulkan laporan harian 7 hari terakhir");
  const dailyReports = await aggregateRecentReports<SOPComplianceData>(MODULE_ID, 7);
  const data = buildWeeklySOPTrend("7 hari terakhir", dailyReports);
  await log.step("trend_check", `${data.chronicViolatorModuleIds.length} AI kronis melanggar SOP`);

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "weekly",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: `Rata-rata ${data.avgViolationCount} pelanggaran per hari minggu ini${data.chronicViolatorModuleIds.length > 0 ? `, kronis: ${data.chronicViolatorModuleIds.join(", ")}` : ""}.`,
    data,
  };
}

async function runMonthly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<MonthlySOPRecap>> {
  await log.step("aggregate", "Mengumpulkan laporan harian sebulan terakhir");
  const dailyReports = await aggregateRecentReports<SOPComplianceData>(MODULE_ID, 30);
  const data = buildMonthlySOPRecap("Bulan ini", dailyReports);
  await log.step("recap", "Rekap kepatuhan SOP bulanan disusun");

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

export const sopGuardianEmployee: AIEmployee<SOPComplianceData | WeeklySOPTrend | MonthlySOPRecap> = {
  id: MODULE_ID,
  name: "SOP Guardian AI",
  role: "Penjaga SOP Perusahaan",
  description:
    "Mengawasi seluruh AI lain — membaca laporan & work log, mendeteksi missed run, run gagal, retry berlebih, dan jejak SOP yang tidak lengkap. Memberi peringatan, tidak pernah mengubah data AI lain. Otomatis mencakup setiap AI baru tanpa perlu diubah kodenya.",
  sop,
  runDaily,
  runWeekly,
  runMonthly,
};
