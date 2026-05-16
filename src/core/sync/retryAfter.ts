// Parse RFC 9110 §10.2.3 `Retry-After`: either `delta-seconds` or `HTTP-date`.
// Returns null when absent/malformed; 0 for past HTTP-dates (engine callers
// treat 0 as "no usable hint" and fall back to their own backoff). Capped at 1h.
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

  // Gate Date.parse on a leading 3-letter token; otherwise V8 parses
  // junk like "-5" into nonsensical epochs.
  if (!/^[A-Za-z]{3}/.test(trimmed)) return null;
  const asDate = Date.parse(trimmed);
  if (!Number.isFinite(asDate)) return null;
  const delta = asDate - now;
  if (delta <= 0) return 0;
  return Math.min(delta, MAX_RETRY_AFTER_MS);
}

// Exponential backoff for 429 retries with jitter to desynchronize tabs.
export function rateLimitedBackoffMs(attempts: number): number {
  const exponent = Math.min(Math.max(0, attempts), 5);
  // Cap the deterministic part before adding jitter so saturated tabs
  // don't all collapse to exactly 30s (thundering herd).
  const base = Math.min(1_000 * 2 ** exponent, 30_000);
  const jitter = Math.floor(Math.random() * 200);
  return base + jitter;
}
