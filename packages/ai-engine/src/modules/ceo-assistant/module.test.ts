import { beforeEach, describe, expect, it } from "vitest";
import { resetRepositoryCache, getRepository } from "@mkh/database";
import type { AIEmployee } from "../../core/ai-employee";
import { runEmployeeTask } from "../../core/agent-runner";
import { ceoAssistantEmployee } from "./module";
import type { ExecutiveSummaryData } from "./types";

describe("ceoAssistantEmployee", () => {
  beforeEach(() => resetRepositoryCache());

  it("runs daily, transitively running every sibling employee that hasn't run yet today, and compiles one Executive Summary", async () => {
    const report = await runEmployeeTask(ceoAssistantEmployee as AIEmployee<ExecutiveSummaryData>, "daily", { triggeredBy: "manual" });
    expect(report.status).toBe("success");
    expect(report.data.periodLabel).toBeTruthy();
    expect(report.data.tomorrowPriorities.length).toBeGreaterThan(0);

    // Every other employee should now have a fresh daily report too.
    const sales = await getRepository().getLatestReport("sales-supervisor");
    const hr = await getRepository().getLatestReport("hr-officer");
    const sop = await getRepository().getLatestReport("sop-guardian");
    expect(sales?.status).toBe("success");
    expect(hr?.status).toBe("success");
    expect(sop?.status).toBe("success");
  });

  it("reuses an already-fresh sibling report instead of re-running it", async () => {
    await runEmployeeTask(ceoAssistantEmployee, "daily", { triggeredBy: "manual" });
    const secondRun = await runEmployeeTask(ceoAssistantEmployee, "daily", { triggeredBy: "manual" });
    expect(secondRun.status).toBe("success");
  });

  it("runs weekly and monthly after a daily run exists", async () => {
    await runEmployeeTask(ceoAssistantEmployee, "daily", { triggeredBy: "manual" });
    const weekly = await runEmployeeTask(ceoAssistantEmployee, "weekly", { triggeredBy: "manual" });
    expect(weekly.status).toBe("success");
    const monthly = await runEmployeeTask(ceoAssistantEmployee, "monthly", { triggeredBy: "manual" });
    expect(monthly.status).toBe("success");
  });
});
