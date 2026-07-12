import { beforeEach, describe, expect, it } from "vitest";
import { resetRepositoryCache } from "@mkh/database";
import type { AIEmployee } from "../../core/ai-employee";
import { runEmployeeTask } from "../../core/agent-runner";
import { branchPerformanceManagerEmployee } from "./module";
import type { BranchPerformanceData } from "./types";

describe("branchPerformanceManagerEmployee", () => {
  beforeEach(() => resetRepositoryCache());

  it("runs daily and produces a branch-by-branch analysis", async () => {
    const report = await runEmployeeTask(branchPerformanceManagerEmployee as AIEmployee<BranchPerformanceData>, "daily", { triggeredBy: "manual" });
    expect(report.status).toBe("success");
    expect(report.data.branches.length).toBeGreaterThan(0);
  });

  it("runs weekly and monthly after a daily run exists", async () => {
    await runEmployeeTask(branchPerformanceManagerEmployee, "daily", { triggeredBy: "manual" });
    const weekly = await runEmployeeTask(branchPerformanceManagerEmployee, "weekly", { triggeredBy: "manual" });
    expect(weekly.status).toBe("success");
    const monthly = await runEmployeeTask(branchPerformanceManagerEmployee, "monthly", { triggeredBy: "manual" });
    expect(monthly.status).toBe("success");
  });
});
