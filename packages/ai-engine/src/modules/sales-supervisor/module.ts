import { generateId, type AIReport, type AIRunContext } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { notify } from "@mkh/notifications";
import type { AIModule } from "../../core/ai-module";
import { buildSupervisionData } from "./logic";
import type { SalesSupervisionData } from "./types";

/** Read-only supervisor — never writes sales data, only observes and recommends. */
export const salesSupervisorModule: AIModule<SalesSupervisionData> = {
  id: "sales-supervisor",
  name: "Sales Supervisor AI",
  description:
    "Menghitung target vs progress penjualan, mendeteksi sales yang tertinggal, dan memberi rekomendasi follow-up + notifikasi ke Dir Ops.",

  async run(_context: AIRunContext): Promise<AIReport<SalesSupervisionData>> {
    const snapshot = await getRepository().getSalesSnapshot();
    const data = buildSupervisionData(snapshot.periodLabel, snapshot.reps);

    if (data.laggingReps.length > 0) {
      const names = data.laggingReps.map((r) => `${r.name} (${r.branch})`).join(", ");
      await notify({
        title: `${data.laggingReps.length} sales tertinggal dari target`,
        body: `Sales berikut perlu perhatian Dir Ops: ${names}.`,
        severity: "warning",
        target: "dir_ops",
        sourceModuleId: "sales-supervisor",
      });
    }

    return {
      id: generateId("rpt"),
      moduleId: "sales-supervisor",
      generatedAt: new Date().toISOString(),
      status: "success",
      summary: `Progress keseluruhan ${data.overallProgressPct}% (${data.periodLabel}), ${data.laggingReps.length} dari ${data.reps.length} sales tertinggal.`,
      data,
    };
  },
};
