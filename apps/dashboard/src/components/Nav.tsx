import Link from "next/link";

const LINKS = [
  { href: "/status", label: "AI Status" },
  { href: "/logs", label: "AI Logs" },
  { href: "/reports", label: "AI Reports" },
  { href: "/scheduler", label: "Scheduler" },
  { href: "/notifications", label: "Notifications" },
  { href: "/integrations", label: "Integrations" },
  { href: "/admin/integrations", label: "AI Integrations" },
];

export function Nav() {
  return (
    <nav className="border-b border-slate-800 bg-panel/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/status" className="font-semibold tracking-tight">
          mkh-ai-os <span className="text-slate-500 font-normal">/ AI Operating System</span>
        </Link>
        <div className="flex gap-1 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
