import { describe, expect, it } from "vitest";
import { DAYS, buildMonthlyRecap, buildOperationsPlan, buildPrioritySummary, buildWeeklyChecklist, findOverdueItems } from "./logic";
import type { OperationsPlan } from "./types";
import type { AIReport } from "@mkh/shared";

describe("buildWeeklyChecklist", () => {
  it("cycles content ideas across all 7 days and marks completion from state", () => {
    const checklist = buildWeeklyChecklist(["Tema A", "Tema B"], [0, 1]);

    expect(checklist).toHaveLength(7);
    expect(checklist[0]?.day).toBe("Senin");
    expect(checklist[0]?.done).toBe(true);
    expect(checklist[2]?.done).toBe(false);
    expect(checklist[0]?.task).toContain("Tema A");
    expect(checklist[1]?.task).toContain("Tema B");
    expect(checklist[2]?.task).toContain("Tema A"); // cycles back
  });

  it("falls back gracefully when there are no content ideas yet", () => {
    const checklist = buildWeeklyChecklist([], []);
    expect(checklist[0]?.task).toContain("belum ada ide baru");
  });

  it("assigns high priority to the first two days", () => {
    const checklist = buildWeeklyChecklist(["Tema A"], []);
    expect(checklist[0]?.priority).toBe("high");
    expect(checklist[1]?.priority).toBe("high");
    expect(checklist[2]?.priority).toBe("medium");
    expect(checklist[6]?.priority).toBe("low");
  });
});

describe("findOverdueItems", () => {
  it("only flags undone items up to and including today, not future days", () => {
    const checklist = buildWeeklyChecklist(["Tema A"], [0]); // Senin done
    const overdue = findOverdueItems(checklist, 2); // today = Rabu (index 2)

    expect(overdue.map((i) => i.day)).toEqual(["Selasa", "Rabu"]);
  });
});

describe("buildPrioritySummary", () => {
  it("reports all-clear when nothing is overdue", () => {
    expect(buildPrioritySummary([])).toContain("sudah selesai");
  });

  it("calls out high-priority overdue items specifically", () => {
    const checklist = buildWeeklyChecklist(["Tema A"], []);
    const overdue = findOverdueItems(checklist, 1); // Senin+Selasa, both high priority
    const summary = buildPrioritySummary(overdue);
    expect(summary).toContain("prioritas tinggi");
  });
});

describe("buildOperationsPlan", () => {
  it("ties incompleteCount to the overdue count for the given day", () => {
    const checklist = buildWeeklyChecklist(["Tema A"], [0, 1]);
    const plan = buildOperationsPlan(checklist, 3, 2);
    expect(plan.incompleteCount).toBe(2); // Rabu, Kamis undone (0,1 done; today=3=Kamis)
    expect(plan.remindersSent).toBe(2);
  });
});

describe("buildMonthlyRecap", () => {
  function dailyReport(data: OperationsPlan): AIReport<OperationsPlan> {
    return { id: "r", moduleId: "marketing-operation", cadence: "daily", generatedAt: "2026-07-12T00:00:00.000Z", status: "success", summary: "", data };
  }

  it("averages incomplete counts and sums reminders across the aggregated days", () => {
    const reports = [
      dailyReport({ weeklyChecklist: [], incompleteCount: 4, remindersSent: 4, prioritySummary: "" }),
      dailyReport({ weeklyChecklist: [], incompleteCount: 2, remindersSent: 2, prioritySummary: "" }),
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
