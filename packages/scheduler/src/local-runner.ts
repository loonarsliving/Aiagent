import cron from "node-cron";
import { createLogger } from "@mkh/shared";
import { getRepository } from "@mkh/database";
import { runScheduledModule } from "./executor";

const logger = createLogger("scheduler:local-runner");
const TIMEZONE = "Asia/Makassar";

function toCronExpression(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  return `${minute} ${hour} * * *`;
}

async function main() {
  const entries = await getRepository().listScheduleEntries();
  const active = entries.filter((e) => e.enabled);

  logger.info("starting local scheduler", {
    timezone: TIMEZONE,
    slots: active.map((e) => `${e.time} -> ${e.moduleId}`),
  });

  for (const entry of active) {
    cron.schedule(
      toCronExpression(entry.time),
      () => {
        runScheduledModule(entry.moduleId, entry.time).catch((err) => {
          logger.error("scheduled run failed", { moduleId: entry.moduleId, error: String(err) });
        });
      },
      { timezone: TIMEZONE },
    );
  }

  logger.info(`local scheduler running — ${active.length} slot(s) armed. Ctrl+C to stop.`);
}

main().catch((err) => {
  logger.error("local scheduler failed to start", { error: String(err) });
  process.exit(1);
});
