import { getRepository } from "@mkh/database";
import { Badge, toneForRunStatus } from "@/components/Badge";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const repo = getRepository();
  const [scheduleRuns, workLog] = await Promise.all([repo.listScheduleRuns(30), repo.listWorkLog({}, 50)]);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">AI Logs</h1>
        <p className="mt-1 text-sm text-slate-400">Riwayat eksekusi scheduler dan jejak langkah SOP granular tiap AI employee.</p>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-medium">Riwayat Jadwal (Scheduler Runs)</h2>
        {scheduleRuns.length === 0 ? (
          <p className="card text-sm text-slate-500">Belum ada run tercatat. Jalankan `pnpm scheduler:dev` atau tunggu cron berikutnya.</p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Cadence</th>
                  <th className="px-4 py-3">Jadwal</th>
                  <th className="px-4 py-3">Mulai</th>
                  <th className="px-4 py-3">Selesai</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {scheduleRuns.map((run) => (
                  <tr key={run.id} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-4 py-3">{run.moduleId}</td>
                    <td className="px-4 py-3 text-slate-400">{run.cadence}</td>
                    <td className="px-4 py-3 text-slate-400">{run.scheduledTime}</td>
                    <td className="px-4 py-3 text-slate-400">{new Date(run.startedAt).toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3 text-slate-400">{run.finishedAt ? new Date(run.finishedAt).toLocaleString("id-ID") : "-"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={toneForRunStatus(run.status)}>{run.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Work Log (Jejak Langkah SOP)</h2>
        {workLog.length === 0 ? (
          <p className="card text-sm text-slate-500">Belum ada langkah tercatat.</p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Langkah</th>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Detail</th>
                </tr>
              </thead>
              <tbody>
                {workLog.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-4 py-3">{entry.moduleId}</td>
                    <td className="px-4 py-3 text-slate-400">{entry.step}</td>
                    <td className="px-4 py-3 text-slate-400">{new Date(entry.loggedAt).toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3">
                      <Badge tone={toneForRunStatus(entry.status)}>{entry.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{entry.detail ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
