import { AgentRegistry } from "./agent-registry";

/**
 * The starting set of self-registrations for this company's ten digital
 * employees — data, not routing logic. `ceo-assistant` is registered
 * last with broad "no other agent claimed this" keywords so it acts as
 * the sensible executive-summary fallback, matching its role elsewhere in
 * the system (see docs/DIGITAL_EMPLOYEES.md).
 */
export function createDefaultAgentRegistry(): AgentRegistry {
  const registry = new AgentRegistry();

  registry.register({
    moduleId: "sales-supervisor",
    keywords: ["sales", "penjualan", "target penjualan", "closing", "prospek", "rep sales"],
    description: "Sales performance, target tracking, and rep coaching",
  });
  registry.register({
    moduleId: "hr-officer",
    keywords: ["hr", "karyawan", "cuti", "payroll", "kehadiran", "staff", "absensi"],
    description: "HR / staffing questions",
  });
  registry.register({
    moduleId: "finance-analyst",
    keywords: ["keuangan", "finance", "cashflow", "transaksi", "anomali transaksi", "invoice", "biaya"],
    description: "Finance, cashflow, and transaction anomalies",
  });
  registry.register({
    moduleId: "branch-performance-manager",
    keywords: ["properti", "villa", "cabang", "branch", "property", "unit rumah"],
    description: "Property / branch performance",
  });
  registry.register({
    moduleId: "marketing-intelligence",
    keywords: ["marketing", "tren", "trend", "riset konten", "campaign", "kompetitor"],
    description: "Marketing research and trend intelligence",
  });
  registry.register({
    moduleId: "content-planner",
    keywords: ["konten", "content", "checklist konten", "jadwal posting"],
    description: "Content planning and posting checklist",
  });
  registry.register({
    moduleId: "meta-ads-specialist",
    keywords: ["ads", "iklan", "meta ads", "cpl", "ctr", "budget iklan", "campaign iklan"],
    description: "Meta Ads campaign analysis",
  });
  registry.register({
    moduleId: "ota-manager",
    keywords: ["ota", "booking", "traveloka", "occupancy", "reservasi", "airbnb"],
    description: "OTA / booking platform management",
  });
  registry.register({
    moduleId: "sop-guardian",
    keywords: ["sop", "kepatuhan", "compliance", "checklist sop"],
    description: "SOP compliance monitoring",
  });
  registry.register({
    moduleId: "ceo-assistant",
    keywords: ["ceo", "owner", "ringkasan", "summary", "prioritas", "laporan harian"],
    description: "Executive summary and general fallback",
  });

  return registry;
}
