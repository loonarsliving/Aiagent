import { generateId, type AIReport, type AIRunContext, type EmployeeSOP } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { getMetaAdsConnector } from "@mkh/connectors";
import { notify } from "@mkh/notifications";
import { KnowledgeBase } from "@mkh/memory";
import type { AIEmployee } from "../../core/ai-employee";
import type { WorkLogger } from "../../core/work-logger";
import { aggregateRecentReports } from "../../core/aggregate-reports";
import { runReasoning } from "../../reasoning";
import type { DailyResearchSummary } from "../marketing-intelligence/types";
import {
  buildMonthlyAdsRecap,
  buildWeeklyComparison,
  computeCampaignMetrics,
  draftNewCampaignProposal,
  newCampaignProposalToRecommendation,
  recommendForCampaign,
} from "./logic";
import { proposeAction } from "./workflow";
import type { MetaAdsAnalysisData, MonthlyAdsRecap, WeeklyCampaignComparison } from "./types";

const MODULE_ID = "meta-ads-specialist" as const;

const sop: EmployeeSOP = {
  daily: [
    { id: "start", offsetMinutes: 0, label: "Mulai bekerja" },
    { id: "fetch_campaigns", offsetMinutes: 5, label: "Membaca performa campaign" },
    { id: "analyze", offsetMinutes: 15, label: "Menghitung CPL/CTR/CPC & membandingkan campaign" },
    { id: "read_intelligence", offsetMinutes: 20, label: "Membaca peluang dari Marketing Intelligence" },
    { id: "draft_proposal", offsetMinutes: 22, label: "Menyusun proposal campaign baru jika ada peluang" },
    { id: "propose_approvals", offsetMinutes: 25, label: "Membuat Approval Request — status WAITING OWNER APPROVAL" },
    { id: "notify", offsetMinutes: 30, label: "Mengirim notifikasi jika ada campaign perlu perhatian" },
    { id: "report", offsetMinutes: 35, label: "Mengirim laporan analisa harian" },
    { id: "ai_reasoning", offsetMinutes: 37, label: "AI melakukan reasoning (Gemini) & menyusun rekomendasi" },
  ],
  weekly: [
    { id: "start", offsetMinutes: 0, label: "Mulai perbandingan mingguan" },
    { id: "aggregate", offsetMinutes: 10, label: "Mengumpulkan laporan harian seminggu terakhir" },
    { id: "compare", offsetMinutes: 20, label: "Membandingkan performa antar hari" },
  ],
  monthly: [
    { id: "start", offsetMinutes: 0, label: "Mulai rekap bulanan" },
    { id: "aggregate", offsetMinutes: 10, label: "Mengumpulkan laporan harian sebulan terakhir" },
    { id: "recap", offsetMinutes: 20, label: "Menyusun rekap approval & performa ads" },
  ],
};

async function runDaily(_context: AIRunContext, log: WorkLogger): Promise<AIReport<MetaAdsAnalysisData>> {
  await log.step("fetch_campaigns", "Membaca performa campaign dari Meta Ads");
  const connector = getMetaAdsConnector();
  const campaigns = await connector.getCampaigns();

  const metrics = campaigns.map(computeCampaignMetrics);
  const recommendations = metrics.map(recommendForCampaign);
  await log.step("analyze", `${metrics.length} campaign dianalisa`);

  await log.step("read_intelligence", "Membaca peluang dari Marketing Intelligence");
  const intelReport = await getRepository().getLatestReport("marketing-intelligence");
  const topOpportunity =
    intelReport?.status === "success" ? (intelReport.data as DailyResearchSummary).topOpportunities?.[0] : undefined;

  const kb = new KnowledgeBase(getRepository());
  const recentProposals = await kb.recall(MODULE_ID, "campaign-proposal", 50);
  const proposal = draftNewCampaignProposal(topOpportunity, new Set(recentProposals.map((p) => p.title)));
  await log.step("draft_proposal", proposal ? `Proposal baru: "${proposal.title}"` : "Tidak ada peluang baru untuk campaign baru hari ini");

  const allRecommendations = proposal ? [...recommendations, newCampaignProposalToRecommendation(proposal)] : recommendations;
  const actionable = allRecommendations.filter((r) => r.action !== "no_action");

  const proposedApprovalIds: string[] = [];
  for (const rec of actionable) {
    const approval = await proposeAction(rec);
    proposedApprovalIds.push(approval.id);
  }
  await kb.remember(
    actionable.map((rec) => ({
      id: `${MODULE_ID}:campaign-proposal:${rec.campaignId}`,
      moduleId: MODULE_ID,
      category: "campaign-proposal",
      title: rec.campaignName,
      metadata: { action: rec.action, reason: rec.reason },
    })),
  );
  await log.step("propose_approvals", `${proposedApprovalIds.length} Approval Request dibuat — status WAITING OWNER APPROVAL`);

  if (actionable.length > 0) {
    await notify({
      title: `${actionable.length} campaign Meta Ads perlu perhatian Owner`,
      body: `Menunggu approval: ${actionable.map((r) => r.campaignName).join(", ")}.`,
      severity: "warning",
      target: "owner",
      sourceModuleId: MODULE_ID,
    });
    await log.step("notify", "Notifikasi dikirim ke Owner");
  } else {
    await log.step("notify", "Tidak ada campaign yang perlu perhatian hari ini");
  }

  const data: MetaAdsAnalysisData = {
    campaigns: metrics,
    recommendations: allRecommendations,
    newCampaignProposals: proposal ? [proposal] : [],
    proposedApprovalIds,
  };

  const summary = `${metrics.length} campaign dianalisa, ${proposedApprovalIds.length} Approval Request menunggu keputusan Owner.`;
  const aiReasoning = await runReasoning(
    {
      moduleId: MODULE_ID,
      observation: summary,
      contextData: {
        campaignCount: metrics.length,
        actionableCount: actionable.length,
        proposedApprovalIds,
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

async function runWeekly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<WeeklyCampaignComparison>> {
  await log.step("aggregate", "Mengumpulkan laporan harian 7 hari terakhir");
  const dailyReports = await aggregateRecentReports<MetaAdsAnalysisData>(MODULE_ID, 7);
  const data = buildWeeklyComparison("7 hari terakhir", dailyReports);
  await log.step("compare", "Perbandingan mingguan disusun");

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "weekly",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary:
      data.recurringCampaignIssues.length > 0
        ? `${data.recurringCampaignIssues.length} campaign butuh aksi berulang minggu ini: ${data.recurringCampaignIssues.join(", ")}.`
        : "Tidak ada campaign dengan masalah berulang minggu ini.",
    data,
  };
}

async function runMonthly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<MonthlyAdsRecap>> {
  await log.step("aggregate", "Mengumpulkan laporan harian sebulan terakhir");
  const dailyReports = await aggregateRecentReports<MetaAdsAnalysisData>(MODULE_ID, 30);
  const approvals = (await getRepository().listApprovals()).filter((a) => a.moduleId === MODULE_ID);
  const data = buildMonthlyAdsRecap("Bulan ini", dailyReports, approvals);
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

export const metaAdsSpecialistEmployee: AIEmployee<MetaAdsAnalysisData | WeeklyCampaignComparison | MonthlyAdsRecap> = {
  id: MODULE_ID,
  name: "Meta Ads Specialist AI",
  role: "Spesialis Meta Ads",
  description:
    "Membaca performa campaign, menghitung CPL/CTR/CPC, menyusun proposal campaign baru (objective/audience/budget/creative/waktu publish) dari peluang Marketing Intelligence, dan membuat Approval Request berstatus WAITING OWNER APPROVAL. Tidak pernah publish otomatis.",
  sop,
  runDaily,
  runWeekly,
  runMonthly,
};
