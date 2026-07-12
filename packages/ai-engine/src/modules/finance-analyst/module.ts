import { generateId, type AIReport, type AIRunContext } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import type { AIModule } from "../../core/ai-module";
import { buildFinanceAnalysis } from "./logic";
import type { FinanceAnalysisData } from "./types";

/** Read-only analyst — never mutates transactions, only reads and reports. */
export const financeAnalystModule: AIModule<FinanceAnalysisData> = {
  id: "finance-analyst",
  name: "Finance Analyst AI",
  description:
    "Membaca transaksi, membuat analisa & prediksi cashflow, mendeteksi pengeluaran tidak biasa, dan membuat laporan untuk Owner.",

  async run(_context: AIRunContext): Promise<AIReport<FinanceAnalysisData>> {
    const snapshot = await getRepository().getFinanceSnapshot();
    const data = buildFinanceAnalysis("14 hari terakhir", snapshot.transactions);

    return {
      id: generateId("rpt"),
      moduleId: "finance-analyst",
      generatedAt: new Date().toISOString(),
      status: "success",
      summary: `Net cashflow Rp${data.netCashflowIdr.toLocaleString("id-ID")}, proyeksi 7 hari ke depan Rp${data.cashflowProjectionNext7dIdr.toLocaleString("id-ID")}, ${data.anomalies.length} transaksi tidak biasa terdeteksi.`,
      data,
    };
  },
};
