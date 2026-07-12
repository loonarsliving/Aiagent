export interface ContentIdea {
  platform: "instagram" | "tiktok";
  theme: string;
  hook: string;
  cta: string;
  suggestedPostingTime: string;
  format: string;
}

export interface ChecklistItem {
  day: string;
  task: string;
  owner: "Markom";
  done: boolean;
}

export interface MarketingStrategyData {
  weeklyChecklist: ChecklistItem[];
  dailyRecommendation: string;
  contentIdeas: ContentIdea[];
  competitorNotes: string[];
}
