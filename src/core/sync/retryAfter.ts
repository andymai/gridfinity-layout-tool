/**
 * Parse an HTTP `Retry-After` header value into a delay in milliseconds.
 *
 * Per RFC 9110 §10.2.3 the value is either:
 *   - `delta-seconds`: a non-negative integer number of seconds
 *   - `HTTP-date`: an absolute date (RFC 1123 format)
 *
 * Returns null if the value is absent, malformed, in the past, or
 * unreasonably large (capped at 1h to bound the wait window).
 */
const MAX_RETRY_AFTER_MS = 60 * 60 * 1_000;

export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;

  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return Math.min(seconds * 1_000, MAX_RETRY_AFTER_MS);
  }

  // Only attempt Date.parse on strings that look like a real HTTP-date
  // (RFC 1123 / RFC 850 / asctime — all start with a 3+ letter token).
  // Without this gate, V8 happily parses things like "-5" into nonsensical
  // year-month epochs.
  if (!/^[A-Za-z]{3}/.test(trimmed)) return null;
  const asDate = Date.parse(trimmed);
  if (!Number.isFinite(asDate)) return null;
  const delta = asDate - now;
  if (delta <= 0) return 0;
  return Math.min(delta, MAX_RETRY_AFTER_MS);
}

/**
 * Exponential backoff for rate-limited (429) retries when no `Retry-After`
 * header is present. Uses the attempt counter as the exponent (capped at
 * 5 so it can't blow past 30s on a busy minute), then adds 0-200ms of
 * jitter so concurrent tabs don't synchronize their retries.
 */
export function rateLimitedBackoffMs(attempts: number): number {
  const exponent = Math.min(Math.max(0, attempts), 5);
  const base = 1_000 * 2 ** exponent;
  const capped = Math.min(base, 30_000);
  const jitter = Math.floor(Math.random() * 200);
  return capped + jitter;
}
