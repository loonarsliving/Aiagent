import { getConfig } from "./config";

function dateKey(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  // en-CA formats as YYYY-MM-DD, which sorts/compares correctly as a plain string.
  return new Intl.DateTimeFormat("en-CA", { timeZone: getConfig().COMPANY_TIMEZONE }).format(date);
}

/** Whether two instants fall on the same calendar day in the company's timezone — NOT the server's local timezone, which may differ once deployed. */
export function isSameCompanyDay(a: Date | string, b: Date | string): boolean {
  return dateKey(a) === dateKey(b);
}
