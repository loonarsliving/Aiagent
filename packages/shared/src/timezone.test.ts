import { describe, expect, it } from "vitest";
import { isSameCompanyDay } from "./timezone";

describe("isSameCompanyDay", () => {
  it("treats two timestamps on the same Asia/Makassar calendar day as the same day", () => {
    // 2026-07-12T23:00:00Z is 2026-07-13T07:00 in Asia/Makassar (UTC+8)
    // 2026-07-13T10:00:00Z is 2026-07-13T18:00 in Asia/Makassar — same WITA day
    expect(isSameCompanyDay("2026-07-12T23:00:00.000Z", "2026-07-13T10:00:00.000Z")).toBe(true);
  });

  it("treats timestamps that are the same UTC day but different WITA days as different", () => {
    // 2026-07-12T00:30:00Z is 2026-07-12T08:30 WITA
    // 2026-07-12T20:00:00Z is 2026-07-13T04:00 WITA — next WITA day, even though same UTC date
    expect(isSameCompanyDay("2026-07-12T00:30:00.000Z", "2026-07-12T20:00:00.000Z")).toBe(false);
  });

  it("returns true when comparing a timestamp to itself", () => {
    const now = new Date();
    expect(isSameCompanyDay(now, now)).toBe(true);
  });

  it("accepts both string and Date inputs interchangeably", () => {
    const iso = "2026-07-12T12:00:00.000Z";
    expect(isSameCompanyDay(iso, new Date(iso))).toBe(true);
  });
});
