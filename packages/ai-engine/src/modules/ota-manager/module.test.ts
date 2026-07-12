import { beforeEach, describe, expect, it } from "vitest";
import { resetRepositoryCache } from "@mkh/database";
import type { AIEmployee } from "../../core/ai-employee";
import { runEmployeeTask } from "../../core/agent-runner";
import { otaManagerEmployee } from "./module";
import type { OTAManagerData } from "./types";

describe("otaManagerEmployee", () => {
  beforeEach(() => resetRepositoryCache());

  it("runs daily and produces a pricing recommendation per property", async () => {
    const report = await runEmployeeTask(otaManagerEmployee as AIEmployee<OTAManagerData>, "daily", { triggeredBy: "manual" });
    expect(report.status).toBe("success");
    expect(report.data.properties.length).toBeGreaterThan(0);
  });

  it("runs weekly and monthly after a daily run exists", async () => {
    await runEmployeeTask(otaManagerEmployee, "daily", { triggeredBy: "manual" });
    const weekly = await runEmployeeTask(otaManagerEmployee, "weekly", { triggeredBy: "manual" });
    expect(weekly.status).toBe("success");
    const monthly = await runEmployeeTask(otaManagerEmployee, "monthly", { triggeredBy: "manual" });
    expect(monthly.status).toBe("success");
  });
});
