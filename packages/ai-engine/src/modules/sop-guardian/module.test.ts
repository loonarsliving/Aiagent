import { beforeEach, describe, expect, it } from "vitest";
import { resetRepositoryCache } from "@mkh/database";
import type { AIEmployee } from "../../core/ai-employee";
import { runEmployeeTask } from "../../core/agent-runner";
import { sopGuardianEmployee } from "./module";
import type { SOPComplianceData } from "./types";
import { financeAnalystEmployee } from "../finance-analyst/module";

describe("sopGuardianEmployee", () => {
  beforeEach(() => resetRepositoryCache());

  it("runs daily and flags every watched employee as a missed run when nothing else has run yet", async () => {
    const report = await runEmployeeTask(sopGuardianEmployee as AIEmployee<SOPComplianceData>, "daily", { triggeredBy: "manual" });
    expect(report.status).toBe("success");
    expect(report.data.employeesChecked).toBeGreaterThan(0);
    expect(report.data.violations.length).toBeGreaterThan(0);
  });

  it("does not flag an employee that already ran today", async () => {
    await runEmployeeTask(financeAnalystEmployee, "daily", { triggeredBy: "manual" });
    const report = await runEmployeeTask(sopGuardianEmployee as AIEmployee<SOPComplianceData>, "daily", { triggeredBy: "manual" });
    expect(report.data.compliantModuleIds).toContain("finance-analyst");
  });

  it("runs weekly and monthly after a daily run exists", async () => {
    await runEmployeeTask(sopGuardianEmployee, "daily", { triggeredBy: "manual" });
    const weekly = await runEmployeeTask(sopGuardianEmployee, "weekly", { triggeredBy: "manual" });
    expect(weekly.status).toBe("success");
    const monthly = await runEmployeeTask(sopGuardianEmployee, "monthly", { triggeredBy: "manual" });
    expect(monthly.status).toBe("success");
  });
});
