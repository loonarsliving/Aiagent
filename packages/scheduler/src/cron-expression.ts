import type { ScheduleEntry } from "@mkh/shared";

/**
 * Converts a cadence-aware ScheduleEntry into a standard 5-field cron
 * expression (minute hour day-of-month month day-of-week). Pure and
 * side-effect free so it's independently testable from the actual cron
 * runner (local-runner.ts, which just feeds this into node-cron).
 */
export function toCronExpression(entry: ScheduleEntry): string {
  const [hourStr, minuteStr] = entry.time.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    throw new Error(`Schedule entry "${entry.id}" has an invalid time: "${entry.time}"`);
  }

  switch (entry.cadence) {
    case "daily":
      return `${minute} ${hour} * * *`;
    case "weekly":
      if (entry.dayOfWeek === undefined) {
        throw new Error(`Weekly schedule entry "${entry.id}" is missing dayOfWeek`);
      }
      return `${minute} ${hour} * * ${entry.dayOfWeek}`;
    case "monthly":
      if (entry.dayOfMonth === undefined) {
        throw new Error(`Monthly schedule entry "${entry.id}" is missing dayOfMonth`);
      }
      return `${minute} ${hour} ${entry.dayOfMonth} * *`;
    default:
      throw new Error(`Unknown cadence for schedule entry "${entry.id}"`);
  }
}
