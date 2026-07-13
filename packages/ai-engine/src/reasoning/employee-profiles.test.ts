import { describe, expect, it } from "vitest";
import { AI_MODULE_IDS } from "@mkh/shared";
import { EMPLOYEE_PROFILES, getEmployeeProfile } from "./employee-profiles";

const ALL_WORKER_IDS = [...AI_MODULE_IDS, "notification-coordinator"] as const;

describe("EMPLOYEE_PROFILES", () => {
  it("has a profile for every one of the 10 employees plus the Notification Coordinator", () => {
    for (const id of ALL_WORKER_IDS) {
      expect(EMPLOYEE_PROFILES[id]).toBeDefined();
      expect(EMPLOYEE_PROFILES[id].moduleId).toBe(id);
    }
    expect(Object.keys(EMPLOYEE_PROFILES)).toHaveLength(ALL_WORKER_IDS.length);
  });

  it("every profile has a non-empty mission and scope", () => {
    for (const id of ALL_WORKER_IDS) {
      expect(EMPLOYEE_PROFILES[id].mission.length).toBeGreaterThan(0);
      expect(EMPLOYEE_PROFILES[id].scope.length).toBeGreaterThan(0);
    }
  });

  it("every profile declares at least 2 KPIs with a metric and target", () => {
    for (const id of ALL_WORKER_IDS) {
      const kpis = EMPLOYEE_PROFILES[id].kpis;
      expect(kpis.length).toBeGreaterThanOrEqual(2);
      for (const kpi of kpis) {
        expect(kpi.metric.length).toBeGreaterThan(0);
        expect(kpi.target.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("getEmployeeProfile", () => {
  it("resolves a registered worker id", () => {
    expect(getEmployeeProfile("finance-analyst").moduleId).toBe("finance-analyst");
  });

  it("throws for an unregistered id", () => {
    // @ts-expect-error deliberately invalid id to exercise the error path
    expect(() => getEmployeeProfile("not-a-real-worker")).toThrow(/No EmployeeProfile registered/);
  });
});
