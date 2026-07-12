import { getRepository } from "@mkh/database";
import { Badge, toneForRunStatus } from "@/components/Badge";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const repo = getRepository();
  const reports = await repo.listReports(undefined, 30);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">AI Reports</h1>
        <p className="mt-1 text-sm text-slate-400">Laporan terbaru dari seluruh AI module, termasuk Executive Summary CEO Assistant.</p>
      </header>

      {reports.length === 0 ? (
        <p className="card text-sm text-slate-500">Belum ada laporan. Jalankan modul lewat scheduler atau manual trigger.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <details key={report.id} className="card">
              <summary className="flex cursor-pointer items-center justify-between">
                <div>
                  <span className="font-medium">{report.moduleId}</span>
                  <span className="ml-3 text-sm text-slate-400">{report.summary}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{new Date(report.generatedAt).toLocaleString("id-ID")}</span>
                  <Badge tone={toneForRunStatus(report.status)}>{report.status}</Badge>
                </div>
              </summary>
              <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-black/30 p-4 text-xs text-slate-300">
                {JSON.stringify(report.data, null, 2)}
              </pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
