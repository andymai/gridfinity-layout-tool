/** Narrow an unknown to an object usable for string-keyed reads. Excludes
 *  null and arrays, but not class instances (Date, Map): same contract as the
 *  local guards this replaced. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
