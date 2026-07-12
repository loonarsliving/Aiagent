import { generateId, type AIReport, type AIRunContext, type EmployeeSOP } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { getSocialResearchConnector, getTrendConnector } from "@mkh/connectors";
import { KnowledgeBase } from "@mkh/memory";
import type { AIEmployee } from "../../core/ai-employee";
import type { WorkLogger } from "../../core/work-logger";
import { aggregateRecentReports } from "../../core/aggregate-reports";
import { buildDailyResearchSummary, buildDiscoveredFacts, buildMonthlyRetrospective, buildWeeklyStrategy } from "./logic";
import type { DailyResearchSummary, MonthlyRetrospective, WeeklyStrategy } from "./types";

const MODULE_ID = "marketing-intelligence" as const;

const sop: EmployeeSOP = {
  daily: [
    { id: "start", offsetMinutes: 0, label: "Mulai bekerja" },
    { id: "trend_analysis", offsetMinutes: 5, label: "Analisa trend Google/Properti/Villa/Skincare" },
    { id: "social_research", offsetMinutes: 15, label: "Riset konten viral Instagram & TikTok" },
    { id: "competitor_analysis", offsetMinutes: 30, label: "Analisa kompetitor" },
    { id: "insight", offsetMinutes: 60, label: "Membuat insight & rekomendasi" },
    { id: "memory_save", offsetMinutes: 75, label: "Menyimpan hasil ke knowledge base" },
    { id: "report", offsetMinutes: 90, label: "Mengirim Market Intelligence Report" },
  ],
  weekly: [
    { id: "start", offsetMinutes: 0, label: "Mulai menyusun strategi mingguan" },
    { id: "aggregate", offsetMinutes: 10, label: "Mengumpulkan laporan harian seminggu terakhir" },
    { id: "strategy", offsetMinutes: 30, label: "Menyusun Weekly Strategy" },
  ],
  monthly: [
    { id: "start", offsetMinutes: 0, label: "Mulai retrospective bulanan" },
    { id: "review_kb", offsetMinutes: 15, label: "Meninjau seluruh knowledge base" },
    { id: "retrospective", offsetMinutes: 45, label: "Menyusun retrospective & rekomendasi" },
  ],
};

async function runDaily(_context: AIRunContext, log: WorkLogger): Promise<AIReport<DailyResearchSummary>> {
  const social = getSocialResearchConnector();
  const trend = getTrendConnector();

  await log.step("trend_analysis", "Mengambil sinyal trend Google/Properti/Villa/Skincare");
  const [googleTrend, propertyTrend, villaTrend, skincareTrend] = await Promise.all([
    trend.getTrends("google"),
    trend.getTrends("property"),
    trend.getTrends("villa"),
    trend.getTrends("skincare"),
  ]);

  await log.step("social_research", "Mengambil konten viral Instagram & TikTok");
  const [viralInstagram, viralTiktok, competitors] = await Promise.all([
    social.getViralContent("instagram"),
    social.getViralContent("tiktok"),
    social.getCompetitorActivity(),
  ]);
  await log.step("competitor_analysis", `${competitors.length} kompetitor dianalisa`);

  const facts = buildDiscoveredFacts(MODULE_ID, viralInstagram, viralTiktok, competitors, [
    ...googleTrend,
    ...propertyTrend,
    ...villaTrend,
    ...skincareTrend,
  ]);

  const kb = new KnowledgeBase(getRepository());
  const rememberResults = await kb.remember(facts);
  await log.step("memory_save", `${rememberResults.length} fakta diproses (${rememberResults.filter((r) => r.isNew).length} baru)`);

  const stats = await kb.stats(MODULE_ID);
  const data = buildDailyResearchSummary(rememberResults, stats);
  await log.step("insight", "Insight & rekomendasi harian disusun");

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "daily",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: `${data.newSignals} sinyal baru, ${data.recurringSignals} sinyal berulang. ${data.dailyRecommendation}`,
    data,
  };
}

async function runWeekly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<WeeklyStrategy>> {
  await log.step("aggregate", "Mengumpulkan laporan harian 7 hari terakhir");
  const dailyReports = await aggregateRecentReports<DailyResearchSummary>(MODULE_ID, 7);
  const data = buildWeeklyStrategy("7 hari terakhir", dailyReports);
  await log.step("strategy", "Weekly Strategy disusun");

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "weekly",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: `Strategi mingguan dari ${data.daysAggregated} laporan harian. ${data.focusForNextWeek}`,
    data,
  };
}

async function runMonthly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<MonthlyRetrospective>> {
  await log.step("review_kb", "Meninjau seluruh knowledge base");
  const kb = new KnowledgeBase(getRepository());
  const [stats, items] = await Promise.all([kb.stats(MODULE_ID), kb.recall(MODULE_ID, undefined, 1000)]);
  const data = buildMonthlyRetrospective("Bulan ini", stats, items);
  await log.step("retrospective", "Retrospective bulanan disusun");

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "monthly",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: data.retrospectiveNote,
    data,
  };
}

export const marketingIntelligenceEmployee: AIEmployee<DailyResearchSummary | WeeklyStrategy | MonthlyRetrospective> = {
  id: MODULE_ID,
  name: "Marketing Intelligence AI",
  role: "Kepala Riset Marketing",
  description:
    "Melakukan riset pasar harian — konten viral Instagram/TikTok, aktivitas kompetitor, trend Google/properti/villa/skincare — membangun knowledge base sendiri, dan bukan membuat desain.",
  sop,
  runDaily,
  runWeekly,
  runMonthly,
};
