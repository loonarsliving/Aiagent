import cron from "node-cron";
import { createLogger, getConfig } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { toCronExpression } from "./cron-expression";
import { runScheduledTask } from "./executor";

const logger = createLogger("scheduler:local-runner");

/**
 * The primary autonomous execution path for this phase: a plain backend
 * process (no UI, no HTTP server) that arms one node-cron job per
 * schedule entry — daily, weekly, and monthly alike — and lets every
 * employee work without being manually triggered. Run with
 * `pnpm scheduler:dev`. HTTP-triggered cron (Vercel, MK Connect webhook)
 * is a future integration concern; runScheduledTask is already shared and
 * ready for that when it's needed.
 */
async function main() {
  const timezone = getConfig().COMPANY_TIMEZONE;
  const entries = await getRepository().listScheduleEntries();
  const active = entries.filter((e) => e.enabled);

  logger.info("starting local scheduler", {
    timezone,
    slots: active.map((e) => `[${e.cadence}] ${e.time} -> ${e.moduleId}`),
  });

  for (const entry of active) {
    const expression = toCronExpression(entry);
    cron.schedule(
      expression,
      () => {
        runScheduledTask(entry).catch((err) => {
          logger.error("scheduled task failed", { moduleId: entry.moduleId, cadence: entry.cadence, error: String(err) });
        });
      },
      { timezone },
    );
  }

  logger.info(`local scheduler running — ${active.length} slot(s) armed across daily/weekly/monthly cadences. Ctrl+C to stop.`);
}

main().catch((err) => {
  logger.error("local scheduler failed to start", { error: String(err) });
  process.exit(1);
});
