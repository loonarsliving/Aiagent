import { generateId, type AIModuleId, type AIReport, type AIRunContext, type EmployeeSOP } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import type { AIEmployee } from "../../core/ai-employee";
import type { WorkLogger } from "../../core/work-logger";
import { runEmployeeTask } from "../../core/agent-runner";
import { aggregateRecentReports } from "../../core/aggregate-reports";
import { marketingIntelligenceEmployee } from "../marketing-intelligence/module";
import type { DailyResearchSummary } from "../marketing-intelligence/types";
import { marketingOperationEmployee } from "../marketing-operation/module";
import type { OperationsPlan } from "../marketing-operation/types";
import { metaAdsOperatorEmployee } from "../meta-ads-operator/module";
import type { MetaAdsAnalysisData } from "../meta-ads-operator/types";
import { salesSupervisorEmployee } from "../sales-supervisor/module";
import type { SalesSupervisionData } from "../sales-supervisor/types";
import { financeAnalystEmployee } from "../finance-analyst/module";
import type { FinanceAnalysisData } from "../finance-analyst/types";
import { buildExecutiveSummary, buildMonthlyBoardReport, buildWeeklyExecutiveRollup } from "./logic";
import type { ExecutiveSummaryData, MonthlyBoardReport, WeeklyExecutiveRollup } from "./types";

const MODULE_ID = "ceo-assistant" as const;

const sop: EmployeeSOP = {
  daily: [
    { id: "start", offsetMinutes: 0, label: "Mulai bekerja" },
    { id: "collect_reports", offsetMinutes: 5, label: "Membaca laporan harian 5 AI lain" },
    { id: "compile_summary", offsetMinutes: 20, label: "Menyusun Executive Summary" },
    { id: "report", offsetMinutes: 25, label: "Mengirim Executive Summary ke Owner" },
  ],
  weekly: [
    { id: "start", offsetMinutes: 0, label: "Mulai rollup mingguan" },
    { id: "aggregate", offsetMinutes: 10, label: "Mengumpulkan Executive Summary seminggu terakhir" },
    { id: "rollup", offsetMinutes: 20, label: "Menyusun rollup mingguan" },
  ],
  monthly: [
    { id: "start", offsetMinutes: 0, label: "Mulai laporan bulanan" },
    { id: "aggregate", offsetMinutes: 10, label: "Mengumpulkan Executive Summary sebulan terakhir" },
    { id: "board_report", offsetMinutes: 20, label: "Menyusun laporan bulanan untuk Owner" },
  ],
};

/** Ensures we have today's report for a sibling employee — reuses the latest one if it's already fresh, otherwise runs it on demand so the summary is never built on stale data. */
async function getOrRunLatestDaily<TData>(moduleId: AIModuleId, employee: AIEmployee<TData>, context: AIRunContext): Promise<TData> {
  const existing = await getRepository().getLatestReport(moduleId);
  const isFresh = existing && isSameDay(existing.generatedAt, new Date());
  if (existing && isFresh) return existing.data as TData;
  const fresh = await runEmployeeTask(employee, "daily", context);
  return fresh.data;
}

function isSameDay(iso: string, now: Date): boolean {
  return new Date(iso).toDateString() === now.toDateString();
}

/**
 * The one employee that reads the other five. Runs last in the daily
 * schedule (18:00) and produces the Owner-facing Executive Summary.
 */
async function runDaily(context: AIRunContext, log: WorkLogger): Promise<AIReport<ExecutiveSummaryData>> {
  await log.step("collect_reports", "Membaca laporan 5 AI lain (menjalankan yang belum jalan hari ini)");
  const [marketingIntelligence, marketingOperation, metaAds, sales, finance, financeSnapshot] = await Promise.all([
    getOrRunLatestDaily<DailyResearchSummary>("marketing-intelligence", marketingIntelligenceEmployee as AIEmployee<DailyResearchSummary>, context),
    getOrRunLatestDaily<OperationsPlan>("marketing-operation", marketingOperationEmployee as AIEmployee<OperationsPlan>, context),
    getOrRunLatestDaily<MetaAdsAnalysisData>("meta-ads-operator", metaAdsOperatorEmployee as AIEmployee<MetaAdsAnalysisData>, context),
    getOrRunLatestDaily<SalesSupervisionData>("sales-supervisor", salesSupervisorEmployee as AIEmployee<SalesSupervisionData>, context),
    getOrRunLatestDaily<FinanceAnalysisData>("finance-analyst", financeAnalystEmployee as AIEmployee<FinanceAnalysisData>, context),
    getRepository().getFinanceSnapshot(),
  ]);

  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  await log.step("compile_summary", "Menyusun Executive Summary");
  const data = buildExecutiveSummary(today, marketingIntelligence, marketingOperation, metaAds, sales, finance, financeSnapshot.transactions);

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "daily",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: `Executive Summary ${today}: ${data.attentionNeeded.length} hal butuh perhatian, ${data.tomorrowPriorities.length} prioritas besok.`,
    data,
  };
}

async function runWeekly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<WeeklyExecutiveRollup>> {
  await log.step("aggregate", "Mengumpulkan Executive Summary 7 hari terakhir");
  const dailyReports = await aggregateRecentReports<ExecutiveSummaryData>(MODULE_ID, 7);
  const data = buildWeeklyExecutiveRollup("7 hari terakhir", dailyReports);
  await log.step("rollup", "Rollup mingguan disusun");

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "weekly",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: `Rata-rata progress sales ${data.avgSalesProgressPct}% minggu ini, ${data.totalMetaAdsApprovalsProposed} approval Meta Ads diajukan.`,
    data,
  };
}

async function runMonthly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<MonthlyBoardReport>> {
  await log.step("aggregate", "Mengumpulkan Executive Summary sebulan terakhir");
  const dailyReports = await aggregateRecentReports<ExecutiveSummaryData>(MODULE_ID, 30);
  const data = buildMonthlyBoardReport("Bulan ini", dailyReports);
  await log.step("board_report", "Laporan bulanan untuk Owner disusun");

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "monthly",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: data.summary,
    data,
  };
}

export const ceoAssistantEmployee: AIEmployee<ExecutiveSummaryData | WeeklyExecutiveRollup | MonthlyBoardReport> = {
  id: MODULE_ID,
  name: "CEO Assistant AI",
  role: "Asisten Eksekutif",
  description:
    "Menggabungkan hasil Marketing Intelligence, Marketing Operation, Meta Ads, Sales, dan Finance AI menjadi Executive Summary harian: hal yang perlu perhatian, rekomendasi, dan prioritas besok.",
  sop,
  runDaily,
  runWeekly,
  runMonthly,
};
