import { beforeEach, describe, expect, it } from "vitest";
import { resetRepositoryCache } from "@mkh/database";
import type { AIEmployee } from "../../core/ai-employee";
import { runEmployeeTask } from "../../core/agent-runner";
import { salesSupervisorEmployee } from "./module";
import type { SalesSupervisionData } from "./types";

describe("salesSupervisorEmployee", () => {
  beforeEach(() => resetRepositoryCache());

  it("runs daily and produces supervision data", async () => {
    const report = await runEmployeeTask(salesSupervisorEmployee as AIEmployee<SalesSupervisionData>, "daily", { triggeredBy: "manual" });
    expect(report.status).toBe("success");
    expect(report.data.reps.length).toBeGreaterThan(0);
  });

  it("runs weekly and monthly after a daily run exists", async () => {
    await runEmployeeTask(salesSupervisorEmployee, "daily", { triggeredBy: "manual" });
    const weekly = await runEmployeeTask(salesSupervisorEmployee, "weekly", { triggeredBy: "manual" });
    expect(weekly.status).toBe("success");
    const monthly = await runEmployeeTask(salesSupervisorEmployee, "monthly", { triggeredBy: "manual" });
    expect(monthly.status).toBe("success");
  });
});
