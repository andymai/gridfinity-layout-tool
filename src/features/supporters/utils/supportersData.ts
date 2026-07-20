import supportersData from '../data/supporters.json';

/** One supporter as served by `/api/supporters`. `name` null = shown anonymously. */
export interface SupporterRecord {
  name: string | null;
  /** ISO timestamp of first support. Absent on the bundled fallback and legacy entries. */
  joinedAt?: string;
  /** Only ever present alongside a name (Ko-fi's public opt-in gates the whole shout-out). */
  message?: string;
}

export interface SupportersData {
  supporters: SupporterRecord[];
}

export interface SupporterBin {
  id: string;
  /** Display name, or null for supporters shown as "Anonymous". */
  name: string | null;
  joinedAt?: string;
  message?: string;
  /** The single most recent supporter (by `joinedAt`), for the arrival glow. */
  isNewest: boolean;
}

/**
 * The list baked into the bundle at build time.
 *
 * Only a fallback now that Redis is the source of truth — it keeps the page
 * showing a plausible baseplate if `/api/supporters` is unreachable. Carries
 * names only (no dates or messages), so recency features stay dormant until the
 * live list loads.
 */
export const FALLBACK_SUPPORTERS: SupportersData = supportersData;

/** Total number of supporters. */
export function getSupporterCount(data: SupportersData = FALLBACK_SUPPORTERS): number {
  return data.supporters.length;
}

/** Index of the most recently joined supporter, or -1 if none carry a date. */
function newestIndex(supporters: SupporterRecord[]): number {
  let best = -1;
  let bestTime = -Infinity;
  supporters.forEach((s, i) => {
    if (!s.joinedAt) return;
    const t = Date.parse(s.joinedAt);
    if (Number.isFinite(t) && t > bestTime) {
      bestTime = t;
      best = i;
    }
  });
  return best;
}

/**
 * Build the full list of supporter bins, shuffled so no one is first or last.
 * `isNewest` is resolved before the shuffle and rides with its bin. Accepts an
 * injectable RNG so tests can assert deterministically.
 */
export function buildSupporterBins(
  data: SupportersData = FALLBACK_SUPPORTERS,
  rng: () => number = Math.random
): SupporterBin[] {
  const newest = newestIndex(data.supporters);
  const bins: SupporterBin[] = data.supporters.map((s, i) => ({
    id: `s-${i}`,
    name: s.name,
    joinedAt: s.joinedAt,
    // A message never rides with an anonymous bin, even if the payload carries one.
    message: s.name ? s.message : undefined,
    isNewest: i === newest,
  }));

  for (let i = bins.length - 1; i > 0; i--) {
    // Clamp so a stray RNG returning exactly 1 can't index out of bounds.
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [bins[i], bins[j]] = [bins[j], bins[i]];
  }

  return bins;
}

/** Count of supporters who joined in the calendar month of `now` (UTC, matching Ko-fi). */
export function joinedThisMonth(
  data: SupportersData = FALLBACK_SUPPORTERS,
  now: Date = new Date()
): number {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return data.supporters.filter((s) => {
    if (!s.joinedAt) return false;
    const d = new Date(s.joinedAt);
    return d.getUTCFullYear() === year && d.getUTCMonth() === month;
  }).length;
}

export interface SupportBucket {
  /** `YYYY-MM` of the bucket. */
  key: string;
  count: number;
}

/**
 * Monthly join counts over the trailing `months` window ending at `now`,
 * oldest first — the series a sparkline plots. Buckets with no joins are 0, so
 * the line has no gaps.
 */
export function supportHistogram(
  data: SupportersData = FALLBACK_SUPPORTERS,
  months: number,
  now: Date = new Date()
): SupportBucket[] {
  const monthKey = (d: Date): string =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

  const buckets: SupportBucket[] = [];
  const indexByKey = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    indexByKey.set(monthKey(d), buckets.length);
    buckets.push({ key: monthKey(d), count: 0 });
  }

  for (const s of data.supporters) {
    if (!s.joinedAt) continue;
    const idx = indexByKey.get(monthKey(new Date(s.joinedAt)));
    if (idx !== undefined) buckets[idx].count += 1;
  }
  return buckets;
}

/** Narrow an unknown API response to `SupportersData`. */
export function isSupportersData(value: unknown): value is SupportersData {
  if (typeof value !== 'object' || value === null) return false;
  // `unknown`-typed so the per-record checks below are genuinely load-bearing on
  // untrusted input, not shortcut away by an over-trusting cast.
  const supporters = (value as { supporters?: unknown }).supporters;
  if (!Array.isArray(supporters)) return false;
  return supporters.every((s: unknown) => {
    if (typeof s !== 'object' || s === null) return false;
    const record = s as { name?: unknown; joinedAt?: unknown; message?: unknown };
    const nameOk = record.name === null || typeof record.name === 'string';
    const joinedOk = record.joinedAt === undefined || typeof record.joinedAt === 'string';
    // A message is only valid alongside a non-empty name: never trust a payload
    // that would attribute words to an opted-out (anonymous) supporter.
    const messageOk =
      record.message === undefined ||
      (typeof record.message === 'string' &&
        typeof record.name === 'string' &&
        record.name.length > 0);
    return nameOk && joinedOk && messageOk;
  });
}
