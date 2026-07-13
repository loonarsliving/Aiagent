import { AI_MODULE_IDS, createLogger, type AIModuleId, type TaskCadence } from "@mkh/shared";
import { triggerAllWorkers, triggerEmployee } from "./manual-trigger";

const logger = createLogger("scheduler:trigger-cli");

const CADENCES: TaskCadence[] = ["daily", "weekly", "monthly"];

function parseArgs(argv: string[]): { moduleId?: string; cadence: TaskCadence; by: string; all: boolean; dryRun: boolean } {
  let moduleId: string | undefined;
  let cadence: TaskCadence = "daily";
  let by = "operator:cli";
  let all = false;
  let dryRun = false;

  for (const arg of argv) {
    if (arg === "--all") {
      all = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    const [key, value] = arg.replace(/^--/, "").split("=");
    if (key === "module" && value) moduleId = value;
    if (key === "cadence" && value) cadence = value as TaskCadence;
    if (key === "by" && value) by = value;
  }

  return { moduleId, cadence, by, all, dryRun };
}

/**
 * `pnpm employee:trigger -- --module=finance-analyst --cadence=daily --by=operator:cli`
 * `pnpm employee:trigger -- --all --cadence=daily` (Trigger by Company — every registered employee)
 * `pnpm employee:trigger -- --module=finance-analyst --dry-run` (validate only, no execution)
 * No UI — this is the manual-trigger service's CLI face. Prints the
 * resulting ScheduleRunRecord(s)/DryRunResult(s) as JSON. The same
 * triggerEmployee()/triggerAllWorkers() functions are meant to be called
 * directly (not via this CLI) once MK Connect integrates.
 */
async function main() {
  const { moduleId, cadence, by, all, dryRun } = parseArgs(process.argv.slice(2));

  if (!CADENCES.includes(cadence)) {
    process.stderr.write(`Unknown cadence "${cadence}". Valid: ${CADENCES.join(", ")}\n`);
    process.exit(1);
  }

  if (all) {
    const runs = await triggerAllWorkers({ cadence, requestedBy: by, dryRun });
    process.stdout.write(`${JSON.stringify(runs, null, 2)}\n`);
    return;
  }

  if (!moduleId || !AI_MODULE_IDS.includes(moduleId as AIModuleId)) {
    process.stderr.write(
      `Usage: employee:trigger --module=<id> [--cadence=daily|weekly|monthly] [--by=<who>] [--dry-run]\n` +
        `       employee:trigger --all [--cadence=daily|weekly|monthly] [--by=<who>] [--dry-run]\n` +
        `Valid module ids: ${AI_MODULE_IDS.join(", ")}\n`,
    );
    process.exit(1);
  }

  const run = await triggerEmployee({ moduleId: moduleId as AIModuleId, cadence, requestedBy: by, dryRun });
  process.stdout.write(`${JSON.stringify(run, null, 2)}\n`);
}

main().catch((err) => {
  logger.error("manual trigger CLI failed", { error: String(err) });
  process.exit(1);
});
