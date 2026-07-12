import { describe, expect, it } from "vitest";
import type { SalesRepProgress } from "@mkh/database";
import { buildRepProgress, buildSupervisionData, classifyRep } from "./logic";

function rep(overrides: Partial<SalesRepProgress> = {}): SalesRepProgress {
  return {
    repId: "rep_test",
    name: "Test Rep",
    branch: "Kendari",
    targetIdr: 100_000_000,
    achievedIdr: 50_000_000,
    lastActivityDaysAgo: 1,
    ...overrides,
  };
}

describe("classifyRep", () => {
  it("marks a rep as achieved once progress hits 100%", () => {
    expect(classifyRep(100, 0)).toBe("achieved");
    expect(classifyRep(120, 10)).toBe("achieved");
  });

  it("marks a rep as lagging when progress is below the threshold", () => {
    expect(classifyRep(40, 1)).toBe("lagging");
  });

  it("marks a rep as lagging when inactive too long, even with decent progress", () => {
    expect(classifyRep(75, 5)).toBe("lagging");
  });

  it("marks a rep as on_track otherwise", () => {
    expect(classifyRep(75, 1)).toBe("on_track");
  });
});

describe("buildRepProgress", () => {
  it("computes progressPct and attaches a follow-up recommendation for lagging reps", () => {
    const progress = buildRepProgress(rep({ targetIdr: 100_000_000, achievedIdr: 30_000_000, lastActivityDaysAgo: 1 }));
    expect(progress.progressPct).toBe(30);
    expect(progress.status).toBe("lagging");
    expect(progress.followUpRecommendation).toBeTruthy();
  });

  it("does not attach a follow-up recommendation for on-track reps", () => {
    const progress = buildRepProgress(rep({ targetIdr: 100_000_000, achievedIdr: 80_000_000, lastActivityDaysAgo: 1 }));
    expect(progress.status).toBe("on_track");
    expect(progress.followUpRecommendation).toBeUndefined();
  });
});

describe("buildSupervisionData", () => {
  it("aggregates overall progress and collects lagging reps", () => {
    const data = buildSupervisionData("Juli 2026", [
      rep({ repId: "a", targetIdr: 100_000_000, achievedIdr: 90_000_000, lastActivityDaysAgo: 0 }),
      rep({ repId: "b", targetIdr: 100_000_000, achievedIdr: 20_000_000, lastActivityDaysAgo: 0 }),
    ]);
    expect(data.overallProgressPct).toBe(55);
    expect(data.laggingReps).toHaveLength(1);
    expect(data.laggingReps[0]?.repId).toBe("b");
  });
});
