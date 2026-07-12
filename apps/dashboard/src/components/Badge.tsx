type BadgeTone = "success" | "error" | "warning" | "info" | "neutral";

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function toneForRunStatus(status: string): BadgeTone {
  if (status === "success" || status === "achieved" || status === "executed") return "success";
  if (status === "error" || status === "failed" || status === "rejected") return "error";
  if (status === "running" || status === "pending" || status === "lagging") return "warning";
  return "neutral";
}
