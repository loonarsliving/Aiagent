import { describe, expect, it } from "vitest";
import { getRepository, resetRepositoryCache } from "@mkh/database";
import type { AIEmployee } from "./ai-employee";
import { runEmployeeTask } from "./agent-runner";

function brokenEmployee(): AIEmployee<{ ok: true }> {
  return {
    id: "finance-analyst",
    name: "Broken Test Employee",
    role: "test",
    description: "throws on purpose",
    sop: {},
    async runDaily() {
      throw new Error("simulated failure inside runDaily");
    },
  };
}

describe("runEmployeeTask error handling", () => {
  it("returns an error-status report instead of rejecting when the task method throws", async () => {
    resetRepositoryCache();
    const report = await runEmployeeTask(brokenEmployee(), "daily", { triggeredBy: "manual" });

    expect(report.status).toBe("error");
    expect(report.error).toContain("simulated failure inside runDaily");
    expect(report.cadence).toBe("daily");
  });

  it("persists the error report so it shows up via getLatestReport", async () => {
    resetRepositoryCache();
    await runEmployeeTask(brokenEmployee(), "daily", { triggeredBy: "manual" });
    const latest = await getRepository().getLatestReport("finance-analyst");

    expect(latest?.status).toBe("error");
  });

  it("returns an error report when a cadence has no handler defined", async () => {
    resetRepositoryCache();
    const employeeWithoutWeekly: AIEmployee<unknown> = {
      id: "finance-analyst",
      name: "No Weekly Employee",
      role: "test",
      description: "has no runWeekly",
      sop: {},
      async runDaily() {
        return {
          id: "rpt_x",
          moduleId: "finance-analyst",
          cadence: "daily",
          generatedAt: new Date().toISOString(),
          status: "success",
          summary: "ok",
          data: {},
        };
      },
    };

    const report = await runEmployeeTask(employeeWithoutWeekly, "weekly", { triggeredBy: "manual" });
    expect(report.status).toBe("error");
    expect(report.error).toContain('no "weekly" task defined');
  });
});
