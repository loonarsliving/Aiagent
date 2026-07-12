import type { CompetitorSnapshot, SocialAccountSnapshot, TrendSignal } from "@mkh/connectors";
import type { ChecklistItem, ContentIdea, MarketingStrategyData } from "./types";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

/** IG performs best evening (post-work scroll); TikTok performs best midday/afternoon — simple, explainable heuristic, swappable later for real per-account analytics. */
const BEST_TIME: Record<"instagram" | "tiktok", string> = {
  instagram: "19:00 WITA",
  tiktok: "12:30 WITA",
};

export function buildContentIdeas(trends: TrendSignal[]): ContentIdea[] {
  return trends.map((trend) => ({
    platform: trend.platform,
    theme: trend.label,
    hook: hookFor(trend),
    cta: ctaFor(trend.platform),
    suggestedPostingTime: BEST_TIME[trend.platform],
    format: trend.platform === "tiktok" ? "video pendek 15-30 detik" : "reel / carousel",
  }));
}

function hookFor(trend: TrendSignal): string {
  if (trend.momentum === "rising") {
    return `"${trend.suggestedAngle}" — buka dengan pertanyaan yang bikin scroll berhenti dalam 2 detik pertama.`;
  }
  return `Buka dengan visual before/after atau angka konkret terkait: ${trend.suggestedAngle}`;
}

function ctaFor(platform: "instagram" | "tiktok"): string {
  return platform === "tiktok"
    ? "Komen 'INFO' untuk brosur & simulasi cicilan gratis."
    : "DM kami atau klik link di bio untuk jadwalkan kunjungan lokasi.";
}

export function buildWeeklyChecklist(ideas: ContentIdea[]): ChecklistItem[] {
  return DAYS.map((day, i) => {
    const idea = ideas[i % ideas.length];
    return {
      day,
      task: idea
        ? `Publish konten ${idea.platform} — tema "${idea.theme}" (${idea.format}) jam ${idea.suggestedPostingTime}`
        : `Review performa konten minggu ini`,
      owner: "Markom" as const,
      done: false,
    };
  });
}

export function buildDailyRecommendation(ideas: ContentIdea[]): string {
  const today = ideas[new Date().getDay() % ideas.length];
  if (!today) return "Belum ada rekomendasi konten — data tren kosong.";
  return `Hari ini: konten ${today.platform} bertema "${today.theme}". Hook: ${today.hook} CTA: ${today.cta} Posting jam ${today.suggestedPostingTime}.`;
}

export function buildCompetitorNotes(competitors: CompetitorSnapshot[], own: SocialAccountSnapshot[]): string[] {
  return competitors.map((c) => {
    const mine = own.find((o) => o.platform === c.platform);
    const gap = mine ? c.followers - mine.followers : c.followers;
    const gapNote = gap > 0 ? `unggul ${gap.toLocaleString("id-ID")} followers dari kita` : `kita unggul ${Math.abs(gap).toLocaleString("id-ID")} followers`;
    return `${c.name} (${c.platform}): ${gapNote}, posting ${c.postFrequencyPerWeek}x/minggu, fokus konten "${c.standoutContentTheme}".`;
  });
}

export function buildStrategyData(
  ownSnapshots: SocialAccountSnapshot[],
  competitors: CompetitorSnapshot[],
  trends: TrendSignal[],
): MarketingStrategyData {
  const contentIdeas = buildContentIdeas(trends);
  return {
    weeklyChecklist: buildWeeklyChecklist(contentIdeas),
    dailyRecommendation: buildDailyRecommendation(contentIdeas),
    contentIdeas,
    competitorNotes: buildCompetitorNotes(competitors, ownSnapshots),
  };
}
