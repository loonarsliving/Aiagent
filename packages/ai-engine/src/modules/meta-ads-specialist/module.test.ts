import { beforeEach, describe, expect, it } from "vitest";
import { resetRepositoryCache } from "@mkh/database";
import type { AIEmployee } from "../../core/ai-employee";
import { runEmployeeTask } from "../../core/agent-runner";
import { metaAdsSpecialistEmployee } from "./module";
import type { MetaAdsAnalysisData } from "./types";
import { marketingIntelligenceEmployee } from "../marketing-intelligence/module";

describe("metaAdsSpecialistEmployee", () => {
  beforeEach(() => resetRepositoryCache());

  it("runs daily and creates approval requests for actionable campaigns, without an upstream Marketing Intelligence report", async () => {
    const report = await runEmployeeTask(metaAdsSpecialistEmployee as AIEmployee<MetaAdsAnalysisData>, "daily", { triggeredBy: "manual" });
    expect(report.status).toBe("success");
    expect(report.data.campaigns.length).toBeGreaterThan(0);
  });

  it("drafts a new campaign proposal once Marketing Intelligence has surfaced an opportunity", async () => {
    await runEmployeeTask(marketingIntelligenceEmployee, "daily", { triggeredBy: "manual" });
    const report = await runEmployeeTask(metaAdsSpecialistEmployee as AIEmployee<MetaAdsAnalysisData>, "daily", { triggeredBy: "manual" });
    expect(report.status).toBe("success");
    expect(report.data.newCampaignProposals.length).toBeGreaterThan(0);
  });

  it("runs weekly and monthly after a daily run exists", async () => {
    await runEmployeeTask(metaAdsSpecialistEmployee, "daily", { triggeredBy: "manual" });
    const weekly = await runEmployeeTask(metaAdsSpecialistEmployee, "weekly", { triggeredBy: "manual" });
    expect(weekly.status).toBe("success");
    const monthly = await runEmployeeTask(metaAdsSpecialistEmployee, "monthly", { triggeredBy: "manual" });
    expect(monthly.status).toBe("success");
  });
});
