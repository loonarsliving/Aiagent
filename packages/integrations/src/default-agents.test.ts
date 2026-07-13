import { describe, expect, it } from "vitest";
import { AI_MODULE_IDS } from "@mkh/shared";
import { createDefaultAgentRegistry } from "./default-agents";

describe("createDefaultAgentRegistry", () => {
  it("registers every one of the ten digital employees", () => {
    const registry = createDefaultAgentRegistry();
    expect(registry.list().map((a) => a.moduleId).sort()).toEqual([...AI_MODULE_IDS].sort());
  });

  it("routes representative messages to the expected agent", () => {
    const registry = createDefaultAgentRegistry();
    expect(registry.resolveBestMatch("Berapa target sales bulan ini?")?.moduleId).toBe("sales-supervisor");
    expect(registry.resolveBestMatch("Saya mau ajukan cuti")?.moduleId).toBe("hr-officer");
    expect(registry.resolveBestMatch("Ada anomali transaksi di cashflow")?.moduleId).toBe("finance-analyst");
    expect(registry.resolveBestMatch("Minta ringkasan untuk owner")?.moduleId).toBe("ceo-assistant");
  });
});
