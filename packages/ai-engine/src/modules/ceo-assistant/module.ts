import { generateId, type AIModuleId, type AIReport, type AIRunContext } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import type { AIModule } from "../../core/ai-module";
import { runModule } from "../../core/agent-runner";
import { marketingStrategistModule } from "../marketing-strategist/module";
import type { MarketingStrategyData } from "../marketing-strategist/types";
import { metaAdsOperatorModule } from "../meta-ads-operator/module";
import type { MetaAdsAnalysisData } from "../meta-ads-operator/types";
import { salesSupervisorModule } from "../sales-supervisor/module";
import type { SalesSupervisionData } from "../sales-supervisor/types";
import { financeAnalystModule } from "../finance-analyst/module";
import type { FinanceAnalysisData } from "../finance-analyst/types";
import { buildExecutiveSummary } from "./logic";
import type { ExecutiveSummaryData } from "./types";

/** Ensures we have today's report for a module — reuses the latest one if it's already fresh, otherwise runs it on demand so the summary is never built on stale data. */
async function getOrRunLatest<TData>(
  moduleId: AIModuleId,
  module: AIModule<TData>,
  context: AIRunContext,
): Promise<TData> {
  const existing = await getRepository().getLatestReport(moduleId);
  const isFresh = existing && isSameDay(existing.generatedAt, new Date());
  if (existing && isFresh) return existing.data as TData;
  const fresh = await runModule(module, context);
  return fresh.data;
}

function isSameDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return d.toDateString() === now.toDateString();
}

/**
 * The one module that reads the other four. Runs last in the daily
 * schedule (18:00) and produces the Owner-facing Executive Summary.
 */
export const ceoAssistantModule: AIModule<ExecutiveSummaryData> = {
  id: "ceo-assistant",
  name: "CEO Assistant AI",
  description:
    "Menggabungkan hasil Marketing, Meta Ads, Sales, dan Finance AI menjadi Executive Summary harian untuk Owner.",

  async run(context: AIRunContext): Promise<AIReport<ExecutiveSummaryData>> {
    const [marketing, metaAds, sales, finance, financeSnapshot] = await Promise.all([
      getOrRunLatest<MarketingStrategyData>("marketing-strategist", marketingStrategistModule, context),
      getOrRunLatest<MetaAdsAnalysisData>("meta-ads-operator", metaAdsOperatorModule, context),
      getOrRunLatest<SalesSupervisionData>("sales-supervisor", salesSupervisorModule, context),
      getOrRunLatest<FinanceAnalysisData>("finance-analyst", financeAnalystModule, context),
      getRepository().getFinanceSnapshot(),
    ]);

    const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const data = buildExecutiveSummary(today, marketing, metaAds, sales, finance, financeSnapshot.transactions);

    return {
      id: generateId("rpt"),
      moduleId: "ceo-assistant",
      generatedAt: new Date().toISOString(),
      status: "success",
      summary: `Executive Summary ${today}: ${data.decisionsNeeded.length} hal butuh keputusan Owner.`,
      data,
    };
  },
};
