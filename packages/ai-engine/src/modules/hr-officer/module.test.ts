import { beforeEach, describe, expect, it } from "vitest";
import { resetRepositoryCache } from "@mkh/database";
import type { AIEmployee } from "../../core/ai-employee";
import { runEmployeeTask } from "../../core/agent-runner";
import { hrOfficerEmployee } from "./module";
import type { HRAnalysisData } from "./types";

describe("hrOfficerEmployee", () => {
  beforeEach(() => resetRepositoryCache());

  it("runs daily and flags staff with attendance/KPI issues", async () => {
    const report = await runEmployeeTask(hrOfficerEmployee as AIEmployee<HRAnalysisData>, "daily", { triggeredBy: "manual" });
    expect(report.status).toBe("success");
    expect(report.data.totalStaff).toBeGreaterThan(0);
    expect(report.data.flaggedStaff.length).toBeGreaterThan(0);
  });

  it("runs weekly and monthly after a daily run exists", async () => {
    await runEmployeeTask(hrOfficerEmployee, "daily", { triggeredBy: "manual" });
    const weekly = await runEmployeeTask(hrOfficerEmployee, "weekly", { triggeredBy: "manual" });
    expect(weekly.status).toBe("success");
    const monthly = await runEmployeeTask(hrOfficerEmployee, "monthly", { triggeredBy: "manual" });
    expect(monthly.status).toBe("success");
  });
});
