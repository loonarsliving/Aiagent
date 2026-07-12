import { getRepository } from "@mkh/database";
import { Badge } from "@/components/Badge";

export const dynamic = "force-dynamic";

const SEVERITY_TONE = { info: "info", warning: "warning", critical: "error" } as const;

export default async function NotificationsPage() {
  const notifications = await getRepository().listNotifications(50);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="mt-1 text-sm text-slate-400">
          Setiap notifikasi tersimpan di sini terlebih dahulu, baru dikirim lewat channel aktif (default: dummy/console).
        </p>
      </header>

      {notifications.length === 0 ? (
        <p className="card text-sm text-slate-500">Belum ada notifikasi. Contoh: &quot;Sales Cabang Makassar belum mencapai target.&quot;</p>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-medium">{n.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{n.body}</p>
                </div>
                <Badge tone={SEVERITY_TONE[n.severity]}>{n.severity}</Badge>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-slate-500">
                <span>channel: {n.channel}</span>
                {n.sourceModuleId && <span>dari: {n.sourceModuleId}</span>}
                {n.target && <span>target: {n.target}</span>}
                <span>{new Date(n.createdAt).toLocaleString("id-ID")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
