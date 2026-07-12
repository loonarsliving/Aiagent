import { NextResponse, type NextRequest } from "next/server";
import { AI_MODULE_IDS, getConfig, type TaskCadence } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { runScheduledTask } from "@mkh/scheduler";

export const dynamic = "force-dynamic";

const CADENCES: TaskCadence[] = ["daily", "weekly", "monthly"];

/**
 * HTTP-triggered cron target for a future serverless deployment (Vercel
 * Cron, or an MK Connect webhook later) — the local node-cron runner
 * (`pnpm scheduler:dev`) is the primary autonomous execution path for this
 * phase; this route exists so the same runScheduledTask() codepath is
 * ready when an HTTP trigger is needed. Vercel automatically sends
 * `Authorization: Bearer $CRON_SECRET` on cron-triggered requests when
 * CRON_SECRET is set as a project env var; we verify it here so this
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
    return NextResponse.json({ error: `Unknown employee id: ${moduleId}` }, { status: 404 });
  }

  const cadenceParam = request.nextUrl.searchParams.get("cadence") ?? "daily";
  if (!CADENCES.includes(cadenceParam as TaskCadence)) {
    return NextResponse.json({ error: `Unknown cadence: ${cadenceParam}` }, { status: 400 });
  }

  const entries = await getRepository().listScheduleEntries();
  const entry = entries.find((e) => e.moduleId === moduleId && e.cadence === cadenceParam);
  if (!entry) {
    return NextResponse.json({ error: `No schedule entry for ${moduleId} / ${cadenceParam}` }, { status: 404 });
  }

  const run = await runScheduledTask(entry);
  return NextResponse.json(run);
}
