import { describe, expect, it } from "vitest";
import type { SalesRepProgress } from "@mkh/database";
import { buildRepProgress, buildSupervisionData, classifyRep, classifyStrategy, recoveryStrategyFor, scalingStrategyFor } from "./logic";

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

describe("classifyStrategy", () => {
  it("assigns recovery strategy to lagging reps", () => {
    expect(classifyStrategy(30, "lagging")).toBe("recovery");
  });

  it("assigns scaling strategy to on-track reps close to target", () => {
    expect(classifyStrategy(92, "on_track")).toBe("scaling");
  });

  it("assigns no strategy to on-track reps not yet close to target", () => {
    expect(classifyStrategy(75, "on_track")).toBe("none");
  });

  it("assigns no strategy once a rep has achieved target", () => {
    expect(classifyStrategy(105, "achieved")).toBe("none");
  });
});

describe("recoveryStrategyFor / scalingStrategyFor", () => {
  it("recovery strategy mentions the rep name and remaining gap", () => {
    const text = recoveryStrategyFor(rep({ name: "Budi", targetIdr: 100_000_000, achievedIdr: 20_000_000 }), 20);
    expect(text).toContain("Budi");
    expect(text).toContain("pemulihan");
  });

  it("scaling strategy mentions the rep name and encourages exceeding target", () => {
    const text = scalingStrategyFor(rep({ name: "Siti", targetIdr: 100_000_000, achievedIdr: 92_000_000 }), 92);
    expect(text).toContain("Siti");
    expect(text).toContain("scaling");
  });
});

describe("buildRepProgress — strategy fields", () => {
  it("attaches a recovery strategy for lagging reps", () => {
    const progress = buildRepProgress(rep({ targetIdr: 100_000_000, achievedIdr: 20_000_000, lastActivityDaysAgo: 1 }));
    expect(progress.strategyType).toBe("recovery");
    expect(progress.strategy).toBeTruthy();
  });

  it("attaches a scaling strategy for reps close to target", () => {
    const progress = buildRepProgress(rep({ targetIdr: 100_000_000, achievedIdr: 92_000_000, lastActivityDaysAgo: 0 }));
    expect(progress.strategyType).toBe("scaling");
    expect(progress.strategy).toBeTruthy();
  });

  it("attaches no strategy for healthy mid-range reps", () => {
    const progress = buildRepProgress(rep({ targetIdr: 100_000_000, achievedIdr: 75_000_000, lastActivityDaysAgo: 0 }));
    expect(progress.strategyType).toBe("none");
    expect(progress.strategy).toBeUndefined();
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
