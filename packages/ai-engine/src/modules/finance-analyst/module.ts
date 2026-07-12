import { generateId, type AIReport, type AIRunContext, type EmployeeSOP } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import type { AIEmployee } from "../../core/ai-employee";
import type { WorkLogger } from "../../core/work-logger";
import { aggregateRecentReports } from "../../core/aggregate-reports";
import { buildFinanceAnalysis, buildMonthlyFinancialReport, buildWeeklyFinancialSummary } from "./logic";
import type { FinanceAnalysisData, MonthlyFinancialReport, WeeklyFinancialSummary } from "./types";

const MODULE_ID = "finance-analyst" as const;

const sop: EmployeeSOP = {
  daily: [
    { id: "start", offsetMinutes: 0, label: "Mulai bekerja" },
    { id: "read_transactions", offsetMinutes: 5, label: "Membaca transaksi" },
    { id: "cashflow_projection", offsetMinutes: 10, label: "Membuat prediksi cashflow" },
    { id: "anomaly_detection", offsetMinutes: 15, label: "Mendeteksi pengeluaran tidak biasa" },
    { id: "report", offsetMinutes: 20, label: "Mengirim laporan untuk Owner" },
  ],
  weekly: [
    { id: "start", offsetMinutes: 0, label: "Mulai ringkasan mingguan" },
    { id: "aggregate", offsetMinutes: 10, label: "Mengumpulkan laporan harian seminggu terakhir" },
    { id: "summarize", offsetMinutes: 20, label: "Menyusun ringkasan finansial mingguan" },
  ],
  monthly: [
    { id: "start", offsetMinutes: 0, label: "Mulai laporan bulanan" },
    { id: "aggregate", offsetMinutes: 10, label: "Mengumpulkan laporan harian sebulan terakhir" },
    { id: "report", offsetMinutes: 20, label: "Menyusun laporan finansial bulanan" },
  ],
};

/** Read-only analyst — never mutates transactions, only reads and reports. */
async function runDaily(_context: AIRunContext, log: WorkLogger): Promise<AIReport<FinanceAnalysisData>> {
  await log.step("read_transactions", "Membaca transaksi");
  const snapshot = await getRepository().getFinanceSnapshot();

  await log.step("cashflow_projection", "Membuat prediksi cashflow");
  const data = buildFinanceAnalysis("14 hari terakhir", snapshot.transactions);
  await log.step("anomaly_detection", `${data.anomalies.length} transaksi tidak biasa terdeteksi`);

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "daily",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: `Net cashflow Rp${data.netCashflowIdr.toLocaleString("id-ID")}, proyeksi 7 hari ke depan Rp${data.cashflowProjectionNext7dIdr.toLocaleString("id-ID")}, ${data.anomalies.length} transaksi tidak biasa terdeteksi.`,
    data,
  };
}

async function runWeekly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<WeeklyFinancialSummary>> {
  await log.step("aggregate", "Mengumpulkan laporan harian 7 hari terakhir");
  const dailyReports = await aggregateRecentReports<FinanceAnalysisData>(MODULE_ID, 7);
  const data = buildWeeklyFinancialSummary("7 hari terakhir", dailyReports);
  await log.step("summarize", "Ringkasan finansial mingguan disusun");

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "weekly",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: `Rata-rata net cashflow harian Rp${data.avgNetCashflowIdr.toLocaleString("id-ID")}, ${data.totalAnomaliesDetected} anomali terdeteksi minggu ini.`,
    data,
  };
}

async function runMonthly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<MonthlyFinancialReport>> {
  await log.step("aggregate", "Mengumpulkan laporan harian sebulan terakhir");
  const dailyReports = await aggregateRecentReports<FinanceAnalysisData>(MODULE_ID, 30);
  const data = buildMonthlyFinancialReport("Bulan ini", dailyReports);
  await log.step("report", "Laporan finansial bulanan disusun");

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

export const financeAnalystEmployee: AIEmployee<FinanceAnalysisData | WeeklyFinancialSummary | MonthlyFinancialReport> = {
  id: MODULE_ID,
  name: "Finance Analyst AI",
  role: "Analis Keuangan",
  description:
    "Membaca transaksi, membuat analisa & prediksi cashflow, mendeteksi pengeluaran tidak biasa, dan membuat laporan untuk Owner. Tidak pernah mengubah transaksi.",
  sop,
  runDaily,
  runWeekly,
  runMonthly,
};
