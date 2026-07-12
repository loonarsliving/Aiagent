import { generateId, isSameCompanyDay, type AIModuleId, type AIReport, type AIRunContext, type EmployeeSOP } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { notify } from "@mkh/notifications";
import { KnowledgeBase } from "@mkh/memory";
import type { AIEmployee } from "../../core/ai-employee";
import type { WorkLogger } from "../../core/work-logger";
import { runEmployeeTask } from "../../core/agent-runner";
import { aggregateRecentReports } from "../../core/aggregate-reports";
import { runReasoning } from "../../reasoning";
import { marketingIntelligenceEmployee } from "../marketing-intelligence/module";
import type { DailyResearchSummary } from "../marketing-intelligence/types";
import { contentPlannerEmployee } from "../content-planner/module";
import type { DailyContentPlan } from "../content-planner/types";
import { metaAdsSpecialistEmployee } from "../meta-ads-specialist/module";
import type { MetaAdsAnalysisData } from "../meta-ads-specialist/types";
import { salesSupervisorEmployee } from "../sales-supervisor/module";
import type { SalesSupervisionData } from "../sales-supervisor/types";
import { branchPerformanceManagerEmployee } from "../branch-performance-manager/module";
import type { BranchPerformanceData } from "../branch-performance-manager/types";
import { financeAnalystEmployee } from "../finance-analyst/module";
import type { FinanceAnalysisData } from "../finance-analyst/types";
import { hrOfficerEmployee } from "../hr-officer/module";
import type { HRAnalysisData } from "../hr-officer/types";
import { otaManagerEmployee } from "../ota-manager/module";
import type { OTAManagerData } from "../ota-manager/types";
import { sopGuardianEmployee } from "../sop-guardian/module";
import type { SOPComplianceData } from "../sop-guardian/types";
import { buildExecutiveSummary, buildMonthlyBoardReport, buildWeeklyExecutiveRollup } from "./logic";
import type { ExecutiveSummaryData, MonthlyBoardReport, WeeklyExecutiveRollup } from "./types";

const MODULE_ID = "ceo-assistant" as const;

const sop: EmployeeSOP = {
  daily: [
    { id: "start", offsetMinutes: 0, label: "Mulai bekerja" },
    { id: "collect_reports", offsetMinutes: 5, label: "Membaca laporan harian 9 AI lain" },
    { id: "compile_summary", offsetMinutes: 20, label: "Menyusun Executive Summary" },
    { id: "memory_save", offsetMinutes: 23, label: "Menyimpan tema perhatian berulang ke memory" },
    { id: "report", offsetMinutes: 25, label: "Mengirim Executive Summary ke Owner" },
    { id: "ai_reasoning", offsetMinutes: 27, label: "AI melakukan reasoning (Gemini) & menyusun rekomendasi" },
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
  const isFresh = existing && isSameCompanyDay(existing.generatedAt, new Date());
  if (existing && isFresh) return existing.data as TData;
  const fresh = await runEmployeeTask(employee, "daily", context);
  return fresh.data;
}

/**
 * The one employee that reads the other nine. Runs last in the daily
 * schedule and produces the Owner-facing Executive Summary. Has its own
 * memory too — tracks which attention themes keep recurring day over day,
 * separate from every other employee's memory.
 */
async function runDaily(context: AIRunContext, log: WorkLogger): Promise<AIReport<ExecutiveSummaryData>> {
  await log.step("collect_reports", "Membaca laporan 9 AI lain (menjalankan yang belum jalan hari ini)");
  const [marketingIntelligence, contentPlanner, metaAds, sales, branches, finance, hr, ota, sopCompliance, financeSnapshot] = await Promise.all([
    getOrRunLatestDaily<DailyResearchSummary>("marketing-intelligence", marketingIntelligenceEmployee as AIEmployee<DailyResearchSummary>, context),
    getOrRunLatestDaily<DailyContentPlan>("content-planner", contentPlannerEmployee as AIEmployee<DailyContentPlan>, context),
    getOrRunLatestDaily<MetaAdsAnalysisData>("meta-ads-specialist", metaAdsSpecialistEmployee as AIEmployee<MetaAdsAnalysisData>, context),
    getOrRunLatestDaily<SalesSupervisionData>("sales-supervisor", salesSupervisorEmployee as AIEmployee<SalesSupervisionData>, context),
    getOrRunLatestDaily<BranchPerformanceData>("branch-performance-manager", branchPerformanceManagerEmployee as AIEmployee<BranchPerformanceData>, context),
    getOrRunLatestDaily<FinanceAnalysisData>("finance-analyst", financeAnalystEmployee as AIEmployee<FinanceAnalysisData>, context),
    getOrRunLatestDaily<HRAnalysisData>("hr-officer", hrOfficerEmployee as AIEmployee<HRAnalysisData>, context),
    getOrRunLatestDaily<OTAManagerData>("ota-manager", otaManagerEmployee as AIEmployee<OTAManagerData>, context),
    getOrRunLatestDaily<SOPComplianceData>("sop-guardian", sopGuardianEmployee as AIEmployee<SOPComplianceData>, context),
    getRepository().getFinanceSnapshot(),
  ]);

  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  await log.step("compile_summary", "Menyusun Executive Summary");
  const data = buildExecutiveSummary(today, {
    marketingIntelligence,
    contentPlanner,
    metaAds,
    sales,
    branches,
    finance,
    hr,
    ota,
    sopCompliance,
    transactions: financeSnapshot.transactions,
  });

  const kb = new KnowledgeBase(getRepository());
  const themes = Array.from(new Set(data.attentionNeeded.map((item) => item.split(":")[0] ?? item)));
  await kb.remember(
    themes.map((theme) => ({
      id: `${MODULE_ID}:attention-theme-history:${theme}`,
      moduleId: MODULE_ID,
      category: "attention-theme-history",
      title: theme,
      metadata: { date: today },
    })),
  );
  await log.step("memory_save", `${themes.length} tema perhatian disimpan ke memory`);

  const summary = `Executive Summary ${today}: ${data.attentionNeeded.length} hal butuh perhatian, ${data.tomorrowPriorities.length} prioritas besok.`;

  await notify({
    title: `Executive Summary — ${today}`,
    body: summary,
    severity: data.attentionNeeded.length > 0 ? "warning" : "info",
    target: "owner",
    sourceModuleId: MODULE_ID,
  });
  await log.step("report", "Executive Summary dikirim ke Owner");

  const aiReasoning = await runReasoning(
    {
      moduleId: MODULE_ID,
      observation: summary,
      contextData: {
        attentionNeeded: data.attentionNeeded,
        tomorrowPriorities: data.tomorrowPriorities,
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
    summary: `Rata-rata progress sales ${data.avgSalesProgressPct}% minggu ini, ${data.totalMetaAdsApprovalsProposed} approval Meta Ads diajukan, ${data.totalSOPViolations} pelanggaran SOP.`,
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
    "Menggabungkan hasil seluruh 9 Digital Employee lain menjadi Executive Summary harian untuk Owner: hal yang perlu perhatian, rekomendasi, dan prioritas besok. Memory sendiri melacak tema perhatian yang berulang dari hari ke hari.",
  sop,
  runDaily,
  runWeekly,
  runMonthly,
};
