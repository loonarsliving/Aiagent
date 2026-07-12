import { describe, expect, it } from "vitest";
import { resetRepositoryCache, getRepository } from "@mkh/database";
import { runScheduledModule } from "./executor";

describe("runScheduledModule", () => {
  it("runs the module, records a schedule run, and links the resulting report", async () => {
    resetRepositoryCache();
    const result = await runScheduledModule("marketing-strategist", "08:00");

    expect(result.status).toBe("success");
    expect(result.reportId).toBeTruthy();
    expect(result.finishedAt).toBeTruthy();

    const runs = await getRepository().listScheduleRuns(5);
    expect(runs.some((r) => r.id === result.id)).toBe(true);
  });

  it("resolves any registered module id, not just the first one", async () => {
    resetRepositoryCache();
    const result = await runScheduledModule("finance-analyst", "15:00");
    expect(result.status).toBe("success");
    expect(result.moduleId).toBe("finance-analyst");
  });
});
