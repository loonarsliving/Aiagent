import { NextResponse, type NextRequest } from "next/server";
import { AI_MODULE_IDS, getConfig } from "@mkh/shared";
import { runScheduledModule } from "@mkh/scheduler";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron target — one entry per module in vercel.json, each hitting
 * this same dynamic route with a different moduleId. Vercel automatically
 * sends `Authorization: Bearer $CRON_SECRET` on cron-triggered requests
 * when CRON_SECRET is set as a project env var; we verify it here so this
 * endpoint can't be used to trigger runs from the open internet.
 */
export async function GET(request: NextRequest, { params }: { params: { moduleId: string } }) {
  const config = getConfig();
  if (config.CRON_SECRET) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${config.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const moduleId = params.moduleId;
  if (!AI_MODULE_IDS.includes(moduleId as (typeof AI_MODULE_IDS)[number])) {
    return NextResponse.json({ error: `Unknown module id: ${moduleId}` }, { status: 404 });
  }

  const run = await runScheduledModule(moduleId as (typeof AI_MODULE_IDS)[number], new Date().toTimeString().slice(0, 5));
  return NextResponse.json(run);
}
