import { beforeEach, describe, expect, it } from "vitest";
import { resetRepositoryCache } from "@mkh/database";
import type { AIEmployee } from "../../core/ai-employee";
import { runEmployeeTask } from "../../core/agent-runner";
import { marketingIntelligenceEmployee } from "./module";
import type { DailyResearchSummary } from "./types";

describe("marketingIntelligenceEmployee", () => {
  beforeEach(() => resetRepositoryCache());

  it("runs daily and builds a research summary from mocked connectors", async () => {
    const report = await runEmployeeTask(marketingIntelligenceEmployee as AIEmployee<DailyResearchSummary>, "daily", { triggeredBy: "manual" });
    expect(report.status).toBe("success");
    expect(report.data.newSignals).toBeGreaterThan(0);
  });

  it("runs weekly and monthly after a daily run exists", async () => {
    await runEmployeeTask(marketingIntelligenceEmployee, "daily", { triggeredBy: "manual" });
    const weekly = await runEmployeeTask(marketingIntelligenceEmployee, "weekly", { triggeredBy: "manual" });
    expect(weekly.status).toBe("success");
    const monthly = await runEmployeeTask(marketingIntelligenceEmployee, "monthly", { triggeredBy: "manual" });
    expect(monthly.status).toBe("success");
  });
});
