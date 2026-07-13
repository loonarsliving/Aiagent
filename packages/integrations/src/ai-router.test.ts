import { describe, expect, it } from "vitest";
import { AgentRegistry } from "./agent-registry";
import { AIRouter } from "./ai-router";

describe("AIRouter", () => {
  it("returns the matched agent's moduleId", () => {
    const registry = new AgentRegistry();
    registry.register({ moduleId: "hr-officer", keywords: ["cuti"], description: "HR" });
    const router = new AIRouter(registry);
    expect(router.route("Saya mau ajukan cuti")).toBe("hr-officer");
  });

  it("returns null when nothing matches", () => {
    const registry = new AgentRegistry();
    registry.register({ moduleId: "hr-officer", keywords: ["cuti"], description: "HR" });
    const router = new AIRouter(registry);
    expect(router.route("completely unrelated text")).toBeNull();
  });
});
