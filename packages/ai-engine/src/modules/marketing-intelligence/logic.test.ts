import { describe, expect, it } from "vitest";
import type { CompetitorActivity, MarketTrendSignal, ViralContentItem } from "@mkh/connectors";
import type { KnowledgeItem } from "@mkh/database";
import type { RememberResult } from "@mkh/memory";
import { buildDailyResearchSummary, buildDiscoveredFacts, buildMonthlyRetrospective, buildWeeklyStrategy } from "./logic";
import type { DailyResearchSummary } from "./types";
import type { AIReport } from "@mkh/shared";

function viralItem(overrides: Partial<ViralContentItem> = {}): ViralContentItem {
  return {
    externalId: "post_1",
    platform: "instagram",
    title: "POV cicilan villa",
    postedAt: "2026-07-12T00:00:00.000Z",
    engagementScore: 5000,
    format: "reel",
    theme: "affordability",
    ...overrides,
  };
}

describe("buildDiscoveredFacts", () => {
  it("produces dedup-keyed facts for viral content, competitors, and trends", () => {
    const competitor: CompetitorActivity = {
      externalId: "cmp_1",
      competitorName: "Griya Asri",
      platform: "instagram",
      followers: 20000,
      postFrequencyPerWeek: 5,
      standoutTheme: "testimoni",
    };
    const trend: MarketTrendSignal = {
      externalId: "trend_1",
      category: "property",
      keyword: "investasi second home",
      momentum: "rising",
      note: "naik",
    };

    const facts = buildDiscoveredFacts("marketing-intelligence", [viralItem()], [], [competitor], [trend]);

    expect(facts).toHaveLength(3);
    expect(facts[0]?.id).toBe("marketing-intelligence:viral-content-instagram:post_1");
    expect(facts[1]?.id).toBe("marketing-intelligence:competitor:cmp_1");
    expect(facts[2]?.id).toBe("marketing-intelligence:trend-property:trend_1");
  });
});

describe("buildDailyResearchSummary", () => {
  function remembered(overrides: Partial<RememberResult> = {}): RememberResult {
    return {
      isNew: true,
      item: {
        id: "x",
        moduleId: "marketing-intelligence",
        category: "viral-content-instagram",
        title: "Tema A",
        firstSeenAt: "2026-07-12T00:00:00.000Z",
        lastSeenAt: "2026-07-12T00:00:00.000Z",
        timesSeen: 1,
        metadata: { engagementScore: 9000 },
      },
      ...overrides,
    };
  }

  it("counts new vs recurring signals and ranks top opportunities by engagement", () => {
    const results: RememberResult[] = [
      remembered({ isNew: true, item: { ...remembered().item, id: "a", title: "Tema A", metadata: { engagementScore: 9000 } } }),
      remembered({ isNew: false, item: { ...remembered().item, id: "b", title: "Tema B", metadata: { engagementScore: 3000 } } }),
    ];

    const summary = buildDailyResearchSummary(results, { totalItems: 2, newToday: 1, recurringToday: 1, byCategory: {} });

    expect(summary.newSignals).toBe(1);
    expect(summary.recurringSignals).toBe(1);
    expect(summary.topOpportunities[0]).toBe("Tema A");
    expect(summary.dailyRecommendation).toContain("Tema A");
  });

  it("gives a fallback recommendation when nothing new stands out", () => {
    const summary = buildDailyResearchSummary([], { totalItems: 0, newToday: 0, recurringToday: 0, byCategory: {} });
    expect(summary.topOpportunities).toHaveLength(0);
    expect(summary.dailyRecommendation).toContain("Belum ada sinyal baru");
  });
});

describe("buildWeeklyStrategy", () => {
  function dailyReport(data: DailyResearchSummary): AIReport<DailyResearchSummary> {
    return {
      id: "rpt",
      moduleId: "marketing-intelligence",
      cadence: "daily",
      generatedAt: "2026-07-12T00:00:00.000Z",
      status: "success",
      summary: "",
      data,
    };
  }

  it("sums new/recurring signals across the week and picks the most frequent theme", () => {
    const reports = [
      dailyReport({ newSignals: 3, recurringSignals: 1, totalKnowledgeItems: 4, topOpportunities: [], dailyRecommendation: "", contentChecklist: ["Tema A", "Tema B"] }),
      dailyReport({ newSignals: 2, recurringSignals: 4, totalKnowledgeItems: 6, topOpportunities: [], dailyRecommendation: "", contentChecklist: ["Tema A"] }),
    ];

    const strategy = buildWeeklyStrategy("minggu ini", reports);

    expect(strategy.knowledgeGrowth.newThisWeek).toBe(5);
    expect(strategy.knowledgeGrowth.recurringThisWeek).toBe(5);
    expect(strategy.strategicThemes[0]).toBe("Tema A");
    expect(strategy.focusForNextWeek).toContain("Tema A");
  });

  it("handles an empty week without throwing", () => {
    const strategy = buildWeeklyStrategy("minggu ini", []);
    expect(strategy.daysAggregated).toBe(0);
    expect(strategy.focusForNextWeek).toContain("Belum cukup data");
  });
});

describe("buildMonthlyRetrospective", () => {
  it("ranks items by timesSeen and summarizes category spread", () => {
    const items: KnowledgeItem[] = [
      { id: "a", moduleId: "marketing-intelligence", category: "viral-content-instagram", title: "Tema A", firstSeenAt: "x", lastSeenAt: "y", timesSeen: 5, metadata: {} },
      { id: "b", moduleId: "marketing-intelligence", category: "trend-property", title: "Tema B", firstSeenAt: "x", lastSeenAt: "y", timesSeen: 9, metadata: {} },
    ];
    const retro = buildMonthlyRetrospective("bulan ini", { totalItems: 2, newToday: 0, recurringToday: 0, byCategory: { "viral-content-instagram": 1, "trend-property": 1 } }, items);

    expect(retro.mostRecurringThemes[0]?.title).toBe("Tema B");
    expect(retro.totalKnowledgeItems).toBe(2);
  });
});
