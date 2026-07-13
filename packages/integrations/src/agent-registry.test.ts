import { describe, expect, it } from "vitest";
import { AgentRegistry } from "./agent-registry";

describe("AgentRegistry", () => {
  it("throws when registering an unknown employee id (fails loudly, not silently)", () => {
    const registry = new AgentRegistry();
    // @ts-expect-error deliberately invalid id to verify the guard rejects it
    expect(() => registry.register({ moduleId: "not-a-real-employee", keywords: ["x"], description: "x" })).toThrow();
  });

  it("registers and lists agents", () => {
    const registry = new AgentRegistry();
    registry.register({ moduleId: "sales-supervisor", keywords: ["sales"], description: "Sales" });
    registry.register({ moduleId: "hr-officer", keywords: ["hr"], description: "HR" });
    expect(registry.list().map((a) => a.moduleId).sort()).toEqual(["hr-officer", "sales-supervisor"]);
  });

  it("get returns the registration for a known id and undefined for an unregistered one", () => {
    const registry = new AgentRegistry();
    registry.register({ moduleId: "sales-supervisor", keywords: ["sales"], description: "Sales" });
    expect(registry.get("sales-supervisor")?.description).toBe("Sales");
    expect(registry.get("hr-officer")).toBeUndefined();
  });

  it("resolveBestMatch picks the agent with the most matching keywords", () => {
    const registry = new AgentRegistry();
    registry.register({ moduleId: "sales-supervisor", keywords: ["sales", "target"], description: "Sales" });
    registry.register({ moduleId: "hr-officer", keywords: ["cuti"], description: "HR" });

    expect(registry.resolveBestMatch("Berapa target sales bulan ini?")?.moduleId).toBe("sales-supervisor");
    expect(registry.resolveBestMatch("Saya mau ajukan cuti")?.moduleId).toBe("hr-officer");
  });

  it("resolveBestMatch returns null when nothing matches", () => {
    const registry = new AgentRegistry();
    registry.register({ moduleId: "sales-supervisor", keywords: ["sales"], description: "Sales" });
    expect(registry.resolveBestMatch("random unrelated text")).toBeNull();
  });

  it("resolveBestMatch is case-insensitive", () => {
    const registry = new AgentRegistry();
    registry.register({ moduleId: "hr-officer", keywords: ["cuti"], description: "HR" });
    expect(registry.resolveBestMatch("CUTI tahunan")?.moduleId).toBe("hr-officer");
  });
});
