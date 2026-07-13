import { getRepository } from "@mkh/database";
import { getConnectorManager } from "@mkh/integrations";
import type { ConnectorStatus, ConnectorType } from "@mkh/shared";
import { Badge } from "@/components/Badge";
import { disableConnectorAction, enableConnectorAction, healthCheckAction, retryConnectorAction } from "./actions";

export const dynamic = "force-dynamic";

const CONNECTOR_LABELS: Record<ConnectorType, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  email: "Email",
  meta: "Meta Marketing",
  mkconnect: "MK Connect",
  ota: "OTA",
};

function toneForConnectorStatus(status: ConnectorStatus): "success" | "error" | "info" | "neutral" {
  if (status === "connected") return "success";
  if (status === "error") return "error";
  if (status === "disconnected") return "neutral";
  return "info"; // mock
}

export default async function AdminIntegrationsPage() {
  const repo = getRepository();
  const manager = getConnectorManager();
  const statuses = await manager.getAllStatuses();

  const rows = await Promise.all(
    statuses.map(async (status) => {
      const [lastLog] = await repo.listIntegrationLogs({ connector: status.type }, 1);
      const pending = await manager.pendingRetryCount(status.type);
      const failed = await manager.failedCount(status.type);
      return { ...status, lastSync: lastLog?.createdAt ?? null, pending, failed };
    }),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">AI Integrations</h1>
        <p className="mt-1 text-sm text-slate-400">
          Sprint 4A — Integration Layer. Setiap channel di bawah backed oleh mock connector (tidak ada panggilan API eksternal nyata) —
          lihat <code className="rounded bg-black/30 px-1 py-0.5">docs/INTEGRATION_LAYER.md</code>. Status &quot;connected&quot; berarti
          env credential terkait sudah terisi, bukan berarti sudah live ke provider asli.
        </p>
      </header>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-slate-400">
            <tr>
              <th className="px-4 py-3">Connector</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last Sync</th>
              <th className="px-4 py-3">Pending Queue</th>
              <th className="px-4 py-3">Failed Queue</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.type} className="border-b border-slate-800/50 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{CONNECTOR_LABELS[row.type]}</div>
                  {!row.configured && (
                    <div className="mt-0.5 font-mono text-xs text-slate-500">env belum diisi: {row.missingEnv.join(", ")}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={toneForConnectorStatus(row.status)}>{row.status}</Badge>
                  {row.health && !row.health.ok && <div className="mt-0.5 text-xs text-rose-400">{row.health.detail}</div>}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {row.lastSync ? new Date(row.lastSync).toLocaleString("id-ID") : "belum pernah"}
                </td>
                <td className="px-4 py-3">{row.pending}</td>
                <td className="px-4 py-3">{row.failed}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <form action={retryConnectorAction}>
                      <input type="hidden" name="connector" value={row.type} />
                      <button
                        type="submit"
                        disabled={row.pending === 0}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Retry
                      </button>
                    </form>
                    <form action={healthCheckAction}>
                      <input type="hidden" name="connector" value={row.type} />
                      <button type="submit" className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800">
                        Health Check
                      </button>
                    </form>
                    <form action={row.disabledByOperator ? enableConnectorAction : disableConnectorAction}>
                      <input type="hidden" name="connector" value={row.type} />
                      <button type="submit" className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800">
                        {row.disabledByOperator ? "Enable" : "Disable"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card text-sm text-slate-400">
        <p>
          <strong className="text-slate-300">Retry</strong> menjalankan ulang job yang sudah lewat waktu tunggu (backoff) di antrian
          connector ini. <strong className="text-slate-300">Health Check</strong> menjalankan ulang pengecekan kesehatan connector dan
          otomatis men-<em>disable</em>-kannya jika tidak sehat. <strong className="text-slate-300">Disable</strong> menghentikan
          connector dari pengiriman baru tanpa menghapus konfigurasi apa pun — aman dibalik kapan saja lewat{" "}
          <strong className="text-slate-300">Enable</strong>.
        </p>
      </div>
    </div>
  );
}
