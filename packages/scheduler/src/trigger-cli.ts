import { AI_MODULE_IDS, createLogger, type AIModuleId, type TaskCadence } from "@mkh/shared";
import { triggerEmployee } from "./manual-trigger";

const logger = createLogger("scheduler:trigger-cli");

const CADENCES: TaskCadence[] = ["daily", "weekly", "monthly"];

function parseArgs(argv: string[]): { moduleId?: string; cadence: TaskCadence; by: string } {
  let moduleId: string | undefined;
  let cadence: TaskCadence = "daily";
  let by = "operator:cli";

  for (const arg of argv) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    if (key === "module" && value) moduleId = value;
    if (key === "cadence" && value) cadence = value as TaskCadence;
    if (key === "by" && value) by = value;
  }

  return { moduleId, cadence, by };
}

/**
 * `pnpm employee:trigger -- --module=finance-analyst --cadence=daily --by=operator:cli`
 * No UI — this is the manual-trigger service's CLI face. Prints the
 * resulting ScheduleRunRecord as JSON. Same triggerEmployee() function is
 * meant to be called directly (not via this CLI) once MK Connect integrates.
 */
async function main() {
  const { moduleId, cadence, by } = parseArgs(process.argv.slice(2));

  if (!moduleId || !AI_MODULE_IDS.includes(moduleId as AIModuleId)) {
    process.stderr.write(
      `Usage: employee:trigger --module=<id> [--cadence=daily|weekly|monthly] [--by=<who>]\nValid module ids: ${AI_MODULE_IDS.join(", ")}\n`,
    );
    process.exit(1);
  }

  if (!CADENCES.includes(cadence)) {
    process.stderr.write(`Unknown cadence "${cadence}". Valid: ${CADENCES.join(", ")}\n`);
    process.exit(1);
  }

  const run = await triggerEmployee({ moduleId: moduleId as AIModuleId, cadence, requestedBy: by });
  process.stdout.write(`${JSON.stringify(run, null, 2)}\n`);
}

main().catch((err) => {
  logger.error("manual trigger CLI failed", { error: String(err) });
  process.exit(1);
});
