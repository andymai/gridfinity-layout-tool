/**
 * Retention policy for ML telemetry aggregates.
 *
 * The TTL is *sliding* — refreshed on every write, not set once at creation.
 * A create-once TTL drops a counter 90 days after it first appeared however
 * much signal it has since accumulated; a sliding one reaps only keys that
 * stopped receiving writes, which is precisely the unbounded tail (label,
 * cluster and drawer-size hashes observed once and never again).
 */
export const ML_AGGREGATE_TTL_SECONDS = 90 * 24 * 60 * 60;

/**
 * Keys the ingest handler deliberately never expires: running totals whose
 * value is their whole history. Nothing refreshes their TTL, so granting one
 * — from a backfill, say — would silently delete them 90 days later.
 */
export const ML_LIFETIME_KEYS: ReadonlySet<string> = new Set([
  'ml:meta:total_events',
  'ml:meta:last_updated',
  'ml:meta:validation:passed',
  'ml:meta:validation:failed',
  'ml:meta:validation:failed_by_type',
]);

/** Whether `key` is an aggregate the ingest path keeps alive with a sliding TTL. */
export function isExpiringAggregate(key: string): boolean {
  return key.startsWith('ml:') && !ML_LIFETIME_KEYS.has(key);
}
