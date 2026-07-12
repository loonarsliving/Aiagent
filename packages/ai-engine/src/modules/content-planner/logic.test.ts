import { describe, expect, it } from "vitest";
import type { AIReport } from "@mkh/shared";
import {
  DAYS,
  buildChecklist,
  buildDailyContentPlan,
  buildMonthlyRecap,
  buildPrioritySummary,
  findOverdueItems,
  pickThemesForWeek,
} from "./logic";
import type { DailyContentPlan } from "./types";

describe("pickThemesForWeek", () => {
  it("prefers ideas not recently used and cycles them across 7 days", () => {
    const themes = pickThemesForWeek(["Tema A", "Tema B"], new Set());
    expect(themes).toHaveLength(7);
    expect(themes[0]?.theme).toBe("Tema A");
    expect(themes[1]?.theme).toBe("Tema B");
    expect(themes[2]?.theme).toBe("Tema A"); // cycles back
    expect(themes.every((t) => t.isFresh)).toBe(true);
  });

  it("falls back to reusing ideas when everything has already been used recently", () => {
    const themes = pickThemesForWeek(["Tema A", "Tema B"], new Set(["Tema A", "Tema B"]));
    expect(themes.every((t) => !t.isFresh)).toBe(true);
    expect(themes[0]?.theme).toBe("Tema A"); // still assigns something, just marks it not-fresh
  });

  it("filters out only the used ideas when some fresh ones remain", () => {
    const themes = pickThemesForWeek(["Tema A", "Tema B", "Tema C"], new Set(["Tema A"]));
    expect(themes.every((t) => t.theme !== "Tema A")).toBe(true);
  });

  it("falls back gracefully when there are no content ideas at all", () => {
    const themes = pickThemesForWeek([], new Set());
    expect(themes[0]?.theme).toContain("belum ada ide baru");
    expect(themes[0]?.isFresh).toBe(false);
  });
});

describe("buildChecklist", () => {
  it("produces 7 items with every required field populated", () => {
    const themes = pickThemesForWeek(["Tema A"], new Set());
    const checklist = buildChecklist(themes, []);

    expect(checklist).toHaveLength(7);
    for (const item of checklist) {
      expect(item.title).toBeTruthy();
      expect(item.contentType).toBeTruthy();
      expect(item.hook).toBeTruthy();
      expect(item.cta).toBeTruthy();
      expect(item.caption).toContain(item.title);
      expect(item.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(item.status).toBe("not_started");
    }
  });

  it("marks completed days as done based on the completion state", () => {
    const themes = pickThemesForWeek(["Tema A"], new Set());
    const checklist = buildChecklist(themes, [0, 1]);
    expect(checklist[0]?.status).toBe("done");
    expect(checklist[1]?.status).toBe("done");
    expect(checklist[2]?.status).toBe("not_started");
  });

  it("assigns high priority to the first two days", () => {
    const themes = pickThemesForWeek(["Tema A"], new Set());
    const checklist = buildChecklist(themes, []);
    expect(checklist[0]?.priority).toBe("high");
    expect(checklist[1]?.priority).toBe("high");
    expect(checklist[2]?.priority).toBe("medium");
    expect(checklist[6]?.priority).toBe("low");
  });
});

describe("findOverdueItems", () => {
  it("only flags undone items up to and including today, not future days", () => {
    const themes = pickThemesForWeek(["Tema A"], new Set());
    const checklist = buildChecklist(themes, [0]); // Senin done
    const overdue = findOverdueItems(checklist, 2); // today = Rabu (index 2)
    expect(overdue.map((i) => i.day)).toEqual(["Selasa", "Rabu"]);
  });
});

describe("buildPrioritySummary", () => {
  it("reports all-clear when nothing is overdue", () => {
    expect(buildPrioritySummary([])).toContain("sudah selesai");
  });

  it("calls out high-priority overdue items specifically", () => {
    const themes = pickThemesForWeek(["Tema A"], new Set());
    const checklist = buildChecklist(themes, []);
    const overdue = findOverdueItems(checklist, 1);
    expect(buildPrioritySummary(overdue)).toContain("prioritas tinggi");
  });
});

describe("buildDailyContentPlan", () => {
  it("ties incompleteCount to the overdue count and carries through freshThemeCount", () => {
    const themes = pickThemesForWeek(["Tema A"], new Set());
    const checklist = buildChecklist(themes, [0, 1]);
    const plan = buildDailyContentPlan(checklist, 3, 2, 5);
    expect(plan.incompleteCount).toBe(2); // Rabu, Kamis undone (0,1 done; today=3=Kamis)
    expect(plan.remindersSent).toBe(2);
    expect(plan.freshThemeCount).toBe(5);
  });
});

describe("buildMonthlyRecap", () => {
  function dailyReport(data: DailyContentPlan): AIReport<DailyContentPlan> {
    return { id: "r", moduleId: "content-planner", cadence: "daily", generatedAt: "2026-07-12T00:00:00.000Z", status: "success", summary: "", data };
  }

  it("averages incomplete counts and sums reminders across the aggregated days", () => {
    const reports = [
      dailyReport({ checklist: [], incompleteCount: 4, remindersSent: 4, prioritySummary: "", freshThemeCount: 0 }),
      dailyReport({ checklist: [], incompleteCount: 2, remindersSent: 2, prioritySummary: "", freshThemeCount: 0 }),
    ];
    const recap = buildMonthlyRecap("bulan ini", reports);
    expect(recap.totalRemindersSent).toBe(6);
    expect(recap.avgIncompletePerDay).toBe(3);
    expect(recap.note).toContain("ditinjau ulang");
  });

  it("handles no daily reports without throwing", () => {
    const recap = buildMonthlyRecap("bulan ini", []);
    expect(recap.daysAggregated).toBe(0);
    expect(recap.note).toContain("Belum ada laporan");
  });
});

describe("DAYS", () => {
  it("has exactly 7 days starting Senin", () => {
    expect(DAYS).toHaveLength(7);
    expect(DAYS[0]).toBe("Senin");
    expect(DAYS[6]).toBe("Minggu");
  });
});
