import { describe, expect, it } from "vitest";
import type { ScheduleEntry } from "@mkh/shared";
import { toCronExpression } from "./cron-expression";

function entry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: "sch_test",
    moduleId: "finance-analyst",
    cadence: "daily",
    time: "08:05",
    label: "test",
    enabled: true,
    ...overrides,
  };
}

describe("toCronExpression", () => {
  it("builds a daily expression from HH:mm", () => {
    expect(toCronExpression(entry({ cadence: "daily", time: "08:05" }))).toBe("5 8 * * *");
  });

  it("builds a weekly expression using dayOfWeek", () => {
    expect(toCronExpression(entry({ cadence: "weekly", time: "06:30", dayOfWeek: 1 }))).toBe("30 6 * * 1");
  });

  it("builds a monthly expression using dayOfMonth", () => {
    expect(toCronExpression(entry({ cadence: "monthly", time: "19:00", dayOfMonth: 1 }))).toBe("0 19 1 * *");
  });

  it("throws when a weekly entry is missing dayOfWeek", () => {
    expect(() => toCronExpression(entry({ cadence: "weekly", dayOfWeek: undefined }))).toThrow("missing dayOfWeek");
  });

  it("throws when a monthly entry is missing dayOfMonth", () => {
    expect(() => toCronExpression(entry({ cadence: "monthly", dayOfMonth: undefined }))).toThrow("missing dayOfMonth");
  });

  it("throws for a malformed time string", () => {
    expect(() => toCronExpression(entry({ time: "not-a-time" }))).toThrow("invalid time");
  });
});
