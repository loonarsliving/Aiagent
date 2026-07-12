import { getRepository } from "@mkh/database";
import { Badge, toneForRunStatus } from "@/components/Badge";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const repo = getRepository();
  const [scheduleRuns, actionLogs] = await Promise.all([repo.listScheduleRuns(30), repo.listActionLogs(30)]);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">AI Logs</h1>
        <p className="mt-1 text-sm text-slate-400">Riwayat eksekusi scheduler dan audit log aksi Meta Ads yang sudah dieksekusi.</p>
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
                  <th className="px-4 py-3">Modul</th>
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
        <h2 className="mb-3 text-lg font-medium">Audit Log Aksi Meta Ads</h2>
        {actionLogs.length === 0 ? (
          <p className="card text-sm text-slate-500">Belum ada aksi yang dieksekusi.</p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Aksi</th>
                  <th className="px-4 py-3">Dieksekusi</th>
                  <th className="px-4 py-3">Hasil</th>
                  <th className="px-4 py-3">Detail</th>
                </tr>
              </thead>
              <tbody>
                {actionLogs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-4 py-3">{log.campaignId}</td>
                    <td className="px-4 py-3 text-slate-400">{log.actionType.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-slate-400">{new Date(log.executedAt).toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3">
                      <Badge tone={toneForRunStatus(log.result)}>{log.result}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{log.detail}</td>
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
