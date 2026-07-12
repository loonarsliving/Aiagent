import { getConfig } from "@mkh/shared";
import { Badge } from "@/components/Badge";

export const dynamic = "force-dynamic";

interface IntegrationRow {
  name: string;
  category: string;
  requiredEnv: string[];
}

const INTEGRATIONS: IntegrationRow[] = [
  { name: "Instagram Graph API", category: "Marketing", requiredEnv: ["INSTAGRAM_GRAPH_TOKEN"] },
  { name: "TikTok API", category: "Marketing", requiredEnv: ["TIKTOK_API_TOKEN"] },
  { name: "Meta Marketing API", category: "Meta Ads", requiredEnv: ["META_ADS_ACCESS_TOKEN", "META_ADS_ACCOUNT_ID"] },
  { name: "WhatsApp Business API", category: "Notifications", requiredEnv: ["WHATSAPP_BUSINESS_TOKEN", "WHATSAPP_BUSINESS_PHONE_ID"] },
  { name: "Telegram Bot API", category: "Notifications", requiredEnv: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"] },
  { name: "Email Provider", category: "Notifications", requiredEnv: ["EMAIL_PROVIDER_API_KEY", "EMAIL_FROM_ADDRESS"] },
  { name: "Push Notifications", category: "Notifications", requiredEnv: ["PUSH_PROVIDER_API_KEY"] },
  { name: "Supabase", category: "Data", requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] },
  { name: "MK Connect (mkh.haluoleo.id)", category: "Internal", requiredEnv: ["MK_CONNECT_BASE_URL", "MK_CONNECT_API_KEY"] },
];

export default function IntegrationsPage() {
  const config = getConfig();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="mt-1 text-sm text-slate-400">
          Data mode saat ini: <span className="font-mono text-slate-200">{config.DATA_MODE}</span>. Semua integrasi di bawah bersifat
          mocked/inert sampai environment variable terkait diisi — lihat <code className="rounded bg-black/30 px-1 py-0.5">.env.example</code>.
        </p>
      </header>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-slate-400">
            <tr>
              <th className="px-4 py-3">Integrasi</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Env vars</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {INTEGRATIONS.map((row) => {
              const configured = row.requiredEnv.every((key) => Boolean(process.env[key]));
              return (
                <tr key={row.name} className="border-b border-slate-800/50 last:border-0">
                  <td className="px-4 py-3">{row.name}</td>
                  <td className="px-4 py-3 text-slate-400">{row.category}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.requiredEnv.join(", ")}</td>
                  <td className="px-4 py-3">
                    <Badge tone={configured ? "success" : "neutral"}>{configured ? "configured" : "not configured (mock)"}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card text-sm text-slate-400">
        MK Connect sengaja diblokir di level kode (<code className="rounded bg-black/30 px-1 py-0.5">packages/connectors/src/mk-connect.ts</code>)
        — tidak akan terhubung ke mkh.haluoleo.id sampai ada instruksi eksplisit dari Owner.
      </div>
    </div>
  );
}
