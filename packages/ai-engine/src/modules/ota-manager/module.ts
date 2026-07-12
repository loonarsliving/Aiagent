import { generateId, type AIReport, type AIRunContext, type EmployeeSOP } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { getOTAConnector } from "@mkh/connectors";
import { notify } from "@mkh/notifications";
import { KnowledgeBase } from "@mkh/memory";
import type { AIEmployee } from "../../core/ai-employee";
import type { WorkLogger } from "../../core/work-logger";
import { aggregateRecentReports } from "../../core/aggregate-reports";
import { buildMonthlyOTARecap, buildOTAManagerData, buildWeeklyOTATrend } from "./logic";
import type { MonthlyOTARecap, OTAManagerData, WeeklyOTATrend } from "./types";

const MODULE_ID = "ota-manager" as const;

const sop: EmployeeSOP = {
  daily: [
    { id: "start", offsetMinutes: 0, label: "Mulai bekerja" },
    { id: "read_ota_data", offsetMinutes: 5, label: "Membaca occupancy, ADR, competitor price, booking pace per properti" },
    { id: "dynamic_pricing_recommendation", offsetMinutes: 12, label: "Menyusun rekomendasi dynamic pricing" },
    { id: "memory_save", offsetMinutes: 15, label: "Menyimpan riwayat rekomendasi harga ke memory" },
    { id: "notify", offsetMinutes: 18, label: "Mengirim notifikasi untuk properti yang butuh penyesuaian harga" },
    { id: "report", offsetMinutes: 20, label: "Mengirim laporan harian" },
  ],
  weekly: [
    { id: "start", offsetMinutes: 0, label: "Mulai analisa tren okupansi mingguan" },
    { id: "aggregate", offsetMinutes: 10, label: "Mengumpulkan laporan harian seminggu terakhir" },
    { id: "trend_check", offsetMinutes: 20, label: "Menilai tren okupansi per properti" },
  ],
  monthly: [
    { id: "start", offsetMinutes: 0, label: "Mulai rekap OTA bulanan" },
    { id: "aggregate", offsetMinutes: 10, label: "Mengumpulkan laporan harian sebulan terakhir" },
    { id: "recap", offsetMinutes: 20, label: "Menyusun rekap OTA bulanan" },
  ],
};

/** Belum konek OTA sungguhan — connector di-mock (lihat @mkh/connectors OTAConnector), tapi seluruh SOP sudah siap dijalankan. */
async function runDaily(_context: AIRunContext, log: WorkLogger): Promise<AIReport<OTAManagerData>> {
  await log.step("read_ota_data", "Membaca occupancy, ADR, competitor price, booking pace per properti");
  const snapshots = await getOTAConnector().getPropertySnapshots();

  const data = buildOTAManagerData("Hari ini", snapshots);
  await log.step("dynamic_pricing_recommendation", `Rekomendasi harga disusun untuk ${data.properties.length} properti`);

  const kb = new KnowledgeBase(getRepository());
  await kb.remember(
    data.properties.map((p) => ({
      id: `${MODULE_ID}:pricing-history:${p.propertyId}`,
      moduleId: MODULE_ID,
      category: "pricing-history",
      title: p.propertyName,
      metadata: { pricingAction: p.pricingAction, occupancyPct: p.occupancyPct, recommendedDynamicPriceIdr: p.recommendedDynamicPriceIdr },
    })),
  );
  await log.step("memory_save", `Riwayat rekomendasi harga disimpan untuk ${data.properties.length} properti`);

  if (data.propertiesNeedingAction.length > 0) {
    await notify({
      title: `${data.propertiesNeedingAction.length} properti perlu penyesuaian harga`,
      body: `Properti berikut direkomendasikan untuk penyesuaian dynamic pricing: ${data.propertiesNeedingAction.join(", ")}.`,
      severity: "info",
      target: "dir_ops",
      sourceModuleId: MODULE_ID,
    });
    await log.step("notify", "Notifikasi dikirim untuk properti yang butuh penyesuaian harga");
  } else {
    await log.step("notify", "Semua properti dalam rentang harga normal, tidak perlu notifikasi");
  }

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "daily",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: `${data.properties.length} properti dianalisa, ${data.propertiesNeedingAction.length} direkomendasikan untuk penyesuaian harga.`,
    data,
  };
}

async function runWeekly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<WeeklyOTATrend>> {
  await log.step("aggregate", "Mengumpulkan laporan harian 7 hari terakhir");
  const dailyReports = await aggregateRecentReports<OTAManagerData>(MODULE_ID, 7);
  const data = buildWeeklyOTATrend("7 hari terakhir", dailyReports);
  await log.step("trend_check", `Tren okupansi dihitung untuk ${data.propertyTrends.length} properti`);

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "weekly",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: `Tren okupansi mingguan disusun untuk ${data.propertyTrends.length} properti dari ${data.daysAggregated} laporan harian.`,
    data,
  };
}

async function runMonthly(_context: AIRunContext, log: WorkLogger): Promise<AIReport<MonthlyOTARecap>> {
  await log.step("aggregate", "Mengumpulkan laporan harian sebulan terakhir");
  const dailyReports = await aggregateRecentReports<OTAManagerData>(MODULE_ID, 30);
  const data = buildMonthlyOTARecap("Bulan ini", dailyReports);
  await log.step("recap", "Rekap OTA bulanan disusun");

  return {
    id: generateId("rpt"),
    moduleId: MODULE_ID,
    cadence: "monthly",
    generatedAt: new Date().toISOString(),
    status: "success",
    summary: data.note,
    data,
  };
}

export const otaManagerEmployee: AIEmployee<OTAManagerData | WeeklyOTATrend | MonthlyOTARecap> = {
  id: MODULE_ID,
  name: "OTA Manager AI",
  role: "Manajer OTA & Dynamic Pricing",
  description:
    "Membaca occupancy, ADR, competitor price, dan booking pace tiap properti, lalu menyusun rekomendasi dynamic pricing. Belum terhubung ke OTA sungguhan — connector di-mock, tapi seluruh SOP siap dijalankan begitu OTA API diaktifkan. Memory sendiri melacak riwayat rekomendasi harga per properti.",
  sop,
  runDaily,
  runWeekly,
  runMonthly,
};
