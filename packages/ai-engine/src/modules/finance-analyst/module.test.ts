import { beforeEach, describe, expect, it } from "vitest";
import { getRepository, resetRepositoryCache } from "@mkh/database";
import type { AIEmployee } from "../../core/ai-employee";
import { runEmployeeTask } from "../../core/agent-runner";
import { financeAnalystEmployee } from "./module";
import type { FinanceAnalysisData } from "./types";

describe("financeAnalystEmployee", () => {
  beforeEach(() => resetRepositoryCache());

  it("runs daily and produces a finance analysis", async () => {
    const report = await runEmployeeTask(financeAnalystEmployee as AIEmployee<FinanceAnalysisData>, "daily", { triggeredBy: "manual" });
    expect(report.status).toBe("success");
    expect(report.data.anomalies).toBeDefined();
  });

  it("notifies the Owner with the daily finance report via the Notification Coordinator", async () => {
    await runEmployeeTask(financeAnalystEmployee, "daily", { triggeredBy: "manual" });
    const notifications = await getRepository().listNotifications(20);
    expect(notifications.some((n) => n.sourceModuleId === "finance-analyst")).toBe(true);
  });

  it("runs weekly and monthly after a daily run exists", async () => {
    await runEmployeeTask(financeAnalystEmployee, "daily", { triggeredBy: "manual" });
    const weekly = await runEmployeeTask(financeAnalystEmployee, "weekly", { triggeredBy: "manual" });
    expect(weekly.status).toBe("success");
    const monthly = await runEmployeeTask(financeAnalystEmployee, "monthly", { triggeredBy: "manual" });
    expect(monthly.status).toBe("success");
  });
});
