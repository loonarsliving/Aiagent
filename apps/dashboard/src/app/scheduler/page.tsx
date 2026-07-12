import { getRepository } from "@mkh/database";
import { Badge } from "@/components/Badge";

export const dynamic = "force-dynamic";

export default async function SchedulerPage() {
  const entries = await getRepository().listScheduleEntries();
  const sorted = [...entries].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Scheduler</h1>
        <p className="mt-1 text-sm text-slate-400">
          Jadwal harian setiap AI module (timezone Asia/Makassar). Modular — tambah AI baru cukup tambah satu baris di{" "}
          <code className="rounded bg-black/30 px-1 py-0.5">packages/database/src/seed-data.ts</code>.
        </p>
      </header>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-slate-400">
            <tr>
              <th className="px-4 py-3">Jam</th>
              <th className="px-4 py-3">Modul</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry) => (
              <tr key={entry.id} className="border-b border-slate-800/50 last:border-0">
                <td className="px-4 py-3 font-mono">{entry.time}</td>
                <td className="px-4 py-3 text-slate-400">{entry.moduleId}</td>
                <td className="px-4 py-3">{entry.label}</td>
                <td className="px-4 py-3">
                  <Badge tone={entry.enabled ? "success" : "neutral"}>{entry.enabled ? "aktif" : "nonaktif"}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card text-sm text-slate-400">
        <p>
          Lokal: jalankan <code className="rounded bg-black/30 px-1 py-0.5">pnpm scheduler:dev</code> untuk menjalankan scheduler ini via
          node-cron.
        </p>
        <p className="mt-1">
          Produksi: Vercel Cron memanggil <code className="rounded bg-black/30 px-1 py-0.5">/api/cron/[moduleId]</code> sesuai jadwal di{" "}
          <code className="rounded bg-black/30 px-1 py-0.5">vercel.json</code>.
        </p>
      </div>
    </div>
  );
}
