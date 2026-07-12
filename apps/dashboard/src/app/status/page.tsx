import { getRepository } from "@mkh/database";
import { AI_MODULE_IDS } from "@mkh/shared";
import { EMPLOYEE_REGISTRY } from "@mkh/ai-engine";
import { Badge, toneForRunStatus } from "@/components/Badge";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const repo = getRepository();
  const statuses = await Promise.all(
    AI_MODULE_IDS.map(async (id) => {
      const report = await repo.getLatestReport(id);
      const module = EMPLOYEE_REGISTRY[id];
      return { id, module, report };
    }),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">AI Status</h1>
        <p className="mt-1 text-sm text-slate-400">
          Status terkini dari setiap AI digital employee. Data mode: dummy (in-memory fixtures).
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {statuses.map(({ id, module, report }) => (
          <div key={id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">{module.name}</h2>
                <p className="mt-1 text-sm text-slate-400">{module.description}</p>
              </div>
              <Badge tone={toneForRunStatus(report?.status ?? "never_run")}>
                {report ? report.status : "belum pernah jalan"}
              </Badge>
            </div>
            <div className="mt-4 border-t border-slate-800 pt-3 text-sm">
              {report ? (
                <>
                  <p className="text-slate-300">{report.summary}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Terakhir jalan: {new Date(report.generatedAt).toLocaleString("id-ID")}
                  </p>
                </>
              ) : (
                <p className="text-slate-500">Belum ada laporan. Jalankan via scheduler atau trigger manual.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
