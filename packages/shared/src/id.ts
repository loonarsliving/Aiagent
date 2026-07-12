/** Prefixed, sortable-enough id generator (e.g. "rpt_3f9a1c..."). No external uuid dependency needed. */
export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
