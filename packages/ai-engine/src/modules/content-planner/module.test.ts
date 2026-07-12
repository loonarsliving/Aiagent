import { beforeEach, describe, expect, it } from "vitest";
import { resetRepositoryCache } from "@mkh/database";
import type { AIEmployee } from "../../core/ai-employee";
import { runEmployeeTask } from "../../core/agent-runner";
import { contentPlannerEmployee } from "./module";
import type { DailyContentPlan } from "./types";

describe("contentPlannerEmployee", () => {
  beforeEach(() => resetRepositoryCache());

  it("runs daily and produces a checklist even with no upstream Marketing Intelligence report yet", async () => {
    const report = await runEmployeeTask(contentPlannerEmployee as AIEmployee<DailyContentPlan>, "daily", { triggeredBy: "manual" });
    expect(report.status).toBe("success");
    expect(report.data.checklist.length).toBeGreaterThan(0);
  });

  it("runs weekly and monthly after a daily run exists", async () => {
    await runEmployeeTask(contentPlannerEmployee, "daily", { triggeredBy: "manual" });
    const weekly = await runEmployeeTask(contentPlannerEmployee, "weekly", { triggeredBy: "manual" });
    expect(weekly.status).toBe("success");
    const monthly = await runEmployeeTask(contentPlannerEmployee, "monthly", { triggeredBy: "manual" });
    expect(monthly.status).toBe("success");
  });
});
