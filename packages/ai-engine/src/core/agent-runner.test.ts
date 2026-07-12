import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetConfigCache } from "@mkh/shared";
import { getRepository, resetRepositoryCache } from "@mkh/database";
import type { AIEmployee } from "./ai-employee";
import { runEmployeeTask } from "./agent-runner";

function alwaysFailsEmployee(): AIEmployee<{ ok: true }> {
  return {
    id: "finance-analyst",
    name: "Broken Test Employee",
    role: "test",
    description: "throws on purpose, every time",
    sop: {},
    async runDaily() {
      throw new Error("simulated failure inside runDaily");
    },
  };
}

function failsNTimesThenSucceeds(failuresBeforeSuccess: number): AIEmployee<{ ok: true }> {
  let calls = 0;
  return {
    id: "finance-analyst",
    name: "Flaky Test Employee",
    role: "test",
    description: "fails a fixed number of times, then succeeds",
    sop: {},
    async runDaily() {
      calls += 1;
      if (calls <= failuresBeforeSuccess) {
        throw new Error(`simulated transient failure #${calls}`);
      }
      return {
        id: "rpt_x",
        moduleId: "finance-analyst",
        cadence: "daily",
        generatedAt: new Date().toISOString(),
        status: "success",
        summary: `succeeded on call ${calls}`,
        data: { ok: true },
      };
    },
  };
}

beforeEach(() => {
  resetRepositoryCache();
});

afterEach(() => {
  delete process.env.MAX_RETRY_ATTEMPTS;
  delete process.env.RETRY_BACKOFF_MS;
  resetConfigCache();
});

describe("runEmployeeTask — no-retry path (MAX_RETRY_ATTEMPTS=1)", () => {
  beforeEach(() => {
    process.env.MAX_RETRY_ATTEMPTS = "1";
    process.env.RETRY_BACKOFF_MS = "0";
    resetConfigCache();
  });

  it("returns an error-status report instead of rejecting when the task method throws", async () => {
    const report = await runEmployeeTask(alwaysFailsEmployee(), "daily", { triggeredBy: "manual" });
    expect(report.status).toBe("error");
    expect(report.error).toContain("simulated failure inside runDaily");
    expect(report.cadence).toBe("daily");
    expect(report.retryCount).toBe(0);
  });

  it("persists the error report so it shows up via getLatestReport", async () => {
    await runEmployeeTask(alwaysFailsEmployee(), "daily", { triggeredBy: "manual" });
    const latest = await getRepository().getLatestReport("finance-analyst");
    expect(latest?.status).toBe("error");
  });

  it("returns an error report when a cadence has no handler defined", async () => {
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

  it("attaches durationMs to a successful report", async () => {
    const employee: AIEmployee<{ ok: true }> = failsNTimesThenSucceeds(0);
    const report = await runEmployeeTask(employee, "daily", { triggeredBy: "manual" });
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
    expect(report.retryCount).toBe(0);
  });
});

describe("runEmployeeTask — retry path", () => {
  beforeEach(() => {
    process.env.MAX_RETRY_ATTEMPTS = "3";
    process.env.RETRY_BACKOFF_MS = "0"; // keep tests fast; exponential factor is still exercised, just with 0ms base
    resetConfigCache();
  });

  it("succeeds on a later attempt after transient failures, without ever rejecting the caller", async () => {
    const employee = failsNTimesThenSucceeds(2); // fails attempt 0 and 1, succeeds on attempt 2
    const report = await runEmployeeTask(employee, "daily", { triggeredBy: "manual" });

    expect(report.status).toBe("success");
    expect(report.retryCount).toBe(2);
    expect(report.summary).toContain("succeeded on call 3");
  });

  it("gives up after exhausting all retry attempts and returns the last error", async () => {
    const report = await runEmployeeTask(alwaysFailsEmployee(), "daily", { triggeredBy: "manual" });

    expect(report.status).toBe("error");
    expect(report.retryCount).toBe(2); // MAX_RETRY_ATTEMPTS - 1
    expect(report.error).toContain("simulated failure inside runDaily");
  });

  it("writes a retry work-log step for each failed attempt before the final one", async () => {
    const employee = failsNTimesThenSucceeds(1);
    const report = await runEmployeeTask(employee, "daily", { triggeredBy: "manual" });

    // Find the run via its own report id isn't available for work log lookup directly,
    // so just assert on the aggregate: a retry step with status "retry" was recorded for this module.
    const entries = await getRepository().listWorkLog({ moduleId: "finance-analyst" }, 50);
    expect(entries.some((e) => e.status === "retry")).toBe(true);
    expect(report.retryCount).toBe(1);
  });
});
