import type { AIModuleId, AIReport } from "@mkh/shared";
import type { CompetitorActivity, MarketTrendSignal, ViralContentItem } from "@mkh/connectors";
import type { DiscoveredFact, KnowledgeStats, RememberResult } from "@mkh/memory";
import type { KnowledgeItem } from "@mkh/database";
import type { DailyResearchSummary, MonthlyRetrospective, WeeklyStrategy } from "./types";

/** Converts one day's raw connector findings into dedup-keyed facts ready for the knowledge base. */
export function buildDiscoveredFacts(
  moduleId: AIModuleId,
  viralInstagram: ViralContentItem[],
  viralTiktok: ViralContentItem[],
  competitors: CompetitorActivity[],
  trends: MarketTrendSignal[],
): DiscoveredFact[] {
  const facts: DiscoveredFact[] = [];

  for (const item of [...viralInstagram, ...viralTiktok]) {
    facts.push({
      id: `${moduleId}:viral-content-${item.platform}:${item.externalId}`,
      moduleId,
      category: `viral-content-${item.platform}`,
      title: item.title,
      sourceUrl: item.url,
      metadata: { engagementScore: item.engagementScore, format: item.format, theme: item.theme },
    });
  }

  for (const c of competitors) {
    facts.push({
      id: `${moduleId}:competitor:${c.externalId}`,
      moduleId,
      category: "competitor",
      title: `${c.competitorName} (${c.platform})`,
      metadata: { followers: c.followers, postFrequencyPerWeek: c.postFrequencyPerWeek, standoutTheme: c.standoutTheme },
    });
  }

  for (const t of trends) {
    facts.push({
      id: `${moduleId}:trend-${t.category}:${t.externalId}`,
      moduleId,
      category: `trend-${t.category}`,
      title: t.keyword,
      metadata: { momentum: t.momentum, note: t.note },
    });
  }

  return facts;
}

export function buildDailyResearchSummary(rememberResults: RememberResult[], stats: KnowledgeStats): DailyResearchSummary {
  const newSignals = rememberResults.filter((r) => r.isNew).length;
  const recurringSignals = rememberResults.filter((r) => !r.isNew).length;

  const engagementOf = (r: RememberResult) => Number(r.item.metadata.engagementScore ?? 0);

  const topOpportunities = rememberResults
    .filter((r) => r.item.category.startsWith("viral-content") || r.item.category.startsWith("trend"))
    .sort((a, b) => engagementOf(b) - engagementOf(a))
    .slice(0, 3)
    .map((r) => r.item.title);

  const contentChecklist = rememberResults
    .filter((r) => r.item.category.startsWith("viral-content"))
    .slice(0, 5)
    .map((r) => r.item.title);

  const dailyRecommendation = topOpportunities[0]
    ? `Prioritaskan konten dengan tema "${topOpportunities[0]}" — sinyal terkuat hari ini.`
    : "Belum ada sinyal baru yang menonjol hari ini; pantau knowledge base yang sudah ada.";

  return {
    newSignals,
    recurringSignals,
    totalKnowledgeItems: stats.totalItems,
    topOpportunities,
    dailyRecommendation,
    contentChecklist,
  };
}

export function buildWeeklyStrategy(periodLabel: string, dailyReports: AIReport<DailyResearchSummary>[]): WeeklyStrategy {
  const newThisWeek = dailyReports.reduce((sum, r) => sum + (r.data?.newSignals ?? 0), 0);
  const recurringThisWeek = dailyReports.reduce((sum, r) => sum + (r.data?.recurringSignals ?? 0), 0);

  const themeCounts = new Map<string, number>();
  for (const report of dailyReports) {
    for (const theme of report.data?.contentChecklist ?? []) {
      themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
    }
  }
  const strategicThemes = Array.from(themeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([theme]) => theme);

  const focusForNextWeek = strategicThemes[0]
    ? `Lanjutkan eksplorasi tema "${strategicThemes[0]}" minggu depan — paling sering muncul di riset harian.`
    : "Belum cukup data harian minggu ini untuk menentukan fokus — pastikan riset harian berjalan.";

  return {
    periodLabel,
    daysAggregated: dailyReports.length,
    knowledgeGrowth: { newThisWeek, recurringThisWeek },
    strategicThemes,
    focusForNextWeek,
  };
}

export function buildMonthlyRetrospective(periodLabel: string, stats: KnowledgeStats, items: KnowledgeItem[]): MonthlyRetrospective {
  const mostRecurringThemes = [...items]
    .sort((a, b) => b.timesSeen - a.timesSeen)
    .slice(0, 5)
    .map((i) => ({ title: i.title, timesSeen: i.timesSeen }));

  const retrospectiveNote =
    stats.totalItems > 0
      ? `Knowledge base memiliki ${stats.totalItems} entri di ${Object.keys(stats.byCategory).length} kategori.`
      : "Knowledge base masih kosong — pastikan riset harian berjalan konsisten.";

  return {
    periodLabel,
    totalKnowledgeItems: stats.totalItems,
    byCategory: stats.byCategory,
    mostRecurringThemes,
    retrospectiveNote,
  };
}
