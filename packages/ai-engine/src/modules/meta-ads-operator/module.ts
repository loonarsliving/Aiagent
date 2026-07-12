import { generateId, type AIReport, type AIRunContext, type EmployeeSOP } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { getMetaAdsConnector } from "@mkh/connectors";
import { notify } from "@mkh/notifications";
import type { AIEmployee } from "../../core/ai-employee";
import type { WorkLogger } from "../../core/work-logger";
import { aggregateRecentReports } from "../../core/aggregate-reports";
import { buildMonthlyAdsRecap, buildWeeklyComparison, computeCampaignMetrics, recommendForCampaign } from "./logic";
import { proposeAction } from "./workflow";
import type { MetaAdsAnalysisData, MonthlyAdsRecap, WeeklyCampaignComparison } from "./types";

const MODULE_ID = "meta-ads-operator" as const;

const sop: EmployeeSOP = {
  daily: [
    { id: "start", offsetMinutes: 0, label: "Mulai bekerja" },
    { id: "fetch_campaigns", offsetMinutes: 5, label: "Membaca performa campaign" },
    { id: "analyze", offsetMinutes: 15, label: "Menghitung CPL/CTR/CPC & membandingkan campaign" },
    { id: "propose_approvals", offsetMinutes: 25, label: "Membuat Approval Request untuk campaign yang butuh aksi" },
    { id: "notify", offsetMinutes: 30, label: "Mengirim notifikasi jika ada campaign perlu perhatian" },
    { id: "report", offsetMinutes: 35, label: "Mengirim laporan analisa harian" },
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
  const actionable = recommendations.filter((r) => r.action !== "no_action");
  await log.step("analyze", `${metrics.length} campaign dianalisa, ${actionable.length} butuh aksi`);

  const proposedApprovalIds: string[] = [];
  for (const rec of actionable) {
    const approval = await proposeAction(rec);
    proposedApprovalIds.push(approval.id);
  }
  await log.step("propose_approvals", `${proposedApprovalIds.length} Approval Request dibuat, menunggu keputusan Owner`);

  if (actionable.length > 0) {
    await notify({
      title: `${actionable.length} campaign Meta Ads perlu perhatian`,
      body: `Campaign berikut butuh keputusan Owner: ${actionable.map((r) => r.campaignName).join(", ")}.`,
      severity: "warning",
      target: "owner",
      sourceModuleId: MODULE_ID,
    });
    await log.step("notify", "Notifikasi dikirim ke Owner");
  } else {
    await log.step("notify", "Tidak ada campaign yang perlu perhatian hari ini");
  }

  const data: MetaAdsAnalysisData = { campaigns: metrics, recommendations, proposedApprovalIds };

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "daily",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: `${metrics.length} campaign dianalisa, ${actionable.length} Approval Request dibuat untuk Owner.`,
    data,
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

export const metaAdsOperatorEmployee: AIEmployee<MetaAdsAnalysisData | WeeklyCampaignComparison | MonthlyAdsRecap> = {
  id: MODULE_ID,
  name: "Meta Ads AI",
  role: "Analis & Operator Meta Ads",
  description:
    "Membaca performa campaign, menghitung CPL/CTR/CPC, memberi rekomendasi, dan membuat Approval Request untuk Owner. Belum melakukan publish atau mengubah campaign — itu tahap berikutnya.",
  sop,
  runDaily,
  runWeekly,
  runMonthly,
};
