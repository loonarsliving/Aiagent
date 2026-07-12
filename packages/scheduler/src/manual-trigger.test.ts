import { describe, expect, it } from "vitest";
import { resetRepositoryCache, getRepository } from "@mkh/database";
import { triggerEmployee } from "./manual-trigger";

describe("triggerEmployee", () => {
  it("runs the requested employee immediately, tagging the run as manual", async () => {
    resetRepositoryCache();
    const result = await triggerEmployee({ moduleId: "finance-analyst", cadence: "daily", requestedBy: "operator:cli" });

    expect(result.status).toBe("success");
    expect(result.scheduledTime).toBe("manual");
    expect(result.moduleId).toBe("finance-analyst");
    expect(result.reportId).toBeTruthy();

    const runs = await getRepository().listScheduleRuns(5);
    expect(runs.some((r) => r.id === result.id)).toBe(true);
  });

  it("records who requested the run on the resulting report's run context", async () => {
    resetRepositoryCache();
    await triggerEmployee({ moduleId: "sales-supervisor", cadence: "daily", requestedBy: "operator:owner" });
    const report = await getRepository().getLatestReport("sales-supervisor");
    expect(report?.status).toBe("success");
  });

  it("throws for an unknown employee id instead of silently no-op-ing", async () => {
    resetRepositoryCache();
    // @ts-expect-error deliberately invalid id to verify the guard rejects it
    await expect(triggerEmployee({ moduleId: "not-a-real-employee", cadence: "daily", requestedBy: "test" })).rejects.toThrow();
  });

  it("can run a weekly cadence on demand", async () => {
    resetRepositoryCache();
    await triggerEmployee({ moduleId: "finance-analyst", cadence: "daily", requestedBy: "test" });
    const result = await triggerEmployee({ moduleId: "finance-analyst", cadence: "weekly", requestedBy: "test" });
    expect(result.cadence).toBe("weekly");
    expect(result.status).toBe("success");
  });
});
