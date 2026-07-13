import { afterEach, describe, expect, it } from "vitest";
import { InMemoryRepository } from "@mkh/database";
import { resetConfigCache } from "@mkh/shared";
import { runHealthCheck } from "./health-check";

describe("runHealthCheck", () => {
  afterEach(() => {
    delete process.env.COMPANY_TIMEZONE;
    resetConfigCache();
  });

  it("reports ok=true with every named check passing against a healthy InMemoryRepository", async () => {
    const repo = new InMemoryRepository();
    const result = await runHealthCheck(repo);

    expect(result.ok).toBe(true);
    const names = result.items.map((i) => i.name).sort();
    expect(names).toEqual(
      ["config", "knowledge", "memory", "notification_queue", "persistence", "queue", "scheduler", "timezone", "workers"].sort(),
    );
    expect(result.items.every((i) => i.ok)).toBe(true);
  });

  it("the queue check actually round-trips a self-test job through enqueue/claim/complete", async () => {
    const repo = new InMemoryRepository();
    const result = await runHealthCheck(repo);
    const queueItem = result.items.find((i) => i.name === "queue");
    expect(queueItem?.ok).toBe(true);
    expect(queueItem?.detail).toContain("round-trip succeeded");

    // the self-test job should have been marked success, not left pending/running behind
    const jobs = await repo.listJobs({ type: "health-check-self-test" });
    expect(jobs.every((j) => j.status === "success")).toBe(true);
  });

  it("flags an invalid COMPANY_TIMEZONE without failing the other checks", async () => {
    process.env.COMPANY_TIMEZONE = "Not/AZoneAtAll";
    resetConfigCache();
    const repo = new InMemoryRepository();

    const result = await runHealthCheck(repo);
    expect(result.ok).toBe(false);
    const timezoneItem = result.items.find((i) => i.name === "timezone");
    expect(timezoneItem?.ok).toBe(false);

    const configItem = result.items.find((i) => i.name === "config");
    expect(configItem?.ok).toBe(true); // config itself still parses; only the IANA validity check fails
  });

  it("defaults to getRepository() when no repository argument is given", async () => {
    const result = await runHealthCheck();
    expect(result.checkedAt).toBeTruthy();
  });
});
