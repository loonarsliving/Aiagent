import { createLogger } from "@mkh/shared";
import type { TrendConnector } from "../../ports/trend.port";
import type { MarketTrendSignal, TrendCategory } from "../../types";

const logger = createLogger("connectors:trend:mock");

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

const EVERGREEN: Record<TrendCategory, MarketTrendSignal[]> = {
  google: [
    { externalId: "google_evergreen_kpr", category: "google", keyword: "simulasi KPR villa", momentum: "steady", note: "Volume pencarian stabil sepanjang tahun, puncak awal bulan (gajian)." },
  ],
  property: [
    { externalId: "property_evergreen_second_home", category: "property", keyword: "investasi second home Sulawesi", momentum: "rising", note: "Minat properti liburan di luar Jawa naik pasca kenaikan harga di Bali." },
  ],
  villa: [
    { externalId: "villa_evergreen_staycation", category: "villa", keyword: "staycation villa keluarga", momentum: "steady", note: "Permintaan konsisten menjelang akhir pekan & libur sekolah." },
  ],
  skincare: [
    { externalId: "skincare_evergreen_sunscreen", category: "skincare", keyword: "sunscreen daerah tropis", momentum: "steady", note: "Konsisten tinggi karena iklim; relevan jika ada lini bisnis skincare terkait gaya hidup properti tropis." },
  ],
};

/**
 * Mocked — never calls Google Trends or any real API. Same evergreen +
 * date-seeded-daily-item pattern as the social research adapter, so
 * knowledge base growth is observable across days. Swap for a real Google
 * Trends / trend-data-vendor call later without touching TrendConnector's
 * shape or any employee logic.
 */
export const mockTrendAdapter: TrendConnector = {
  async getTrends(category: TrendCategory): Promise<MarketTrendSignal[]> {
    logger.debug("mock trend lookup", { category });
    const date = todayKey();
    return [
      ...EVERGREEN[category],
      {
        externalId: `${category}_daily_${date}`,
        category,
        keyword: `${category} trend harian (${date})`,
        momentum: "rising",
        note: `Sinyal baru terdeteksi ${date} untuk kategori ${category}.`,
      },
    ];
  },
};
