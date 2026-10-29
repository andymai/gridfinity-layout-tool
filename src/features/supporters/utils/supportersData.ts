import supportersData from '../data/supporters.json';
import { isSupporterDepartment } from '../constants';

/** One supporter as served by `/api/supporters`. `name` null = shown anonymously. */
export interface SupporterRecord {
  name: string | null;
  /** ISO timestamp of first support. Absent on the bundled fallback and legacy entries. */
  joinedAt?: string;
  /** Only ever present alongside a name (Ko-fi's public opt-in gates the whole shout-out). */
  message?: string;
  /** Server-assigned credits department; absent on the bundled fallback and for anonymous. */
  department?: number;
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
  department?: number;
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
    department: s.name ? s.department : undefined,
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

/** Narrow an unknown API response to `SupportersData`. */
export function isSupportersData(value: unknown): value is SupportersData {
  if (typeof value !== 'object' || value === null) return false;
  // `unknown`-typed so the per-record checks below are genuinely load-bearing on
  // untrusted input, not shortcut away by an over-trusting cast.
  const supporters = (value as { supporters?: unknown }).supporters;
  if (!Array.isArray(supporters)) return false;
  return supporters.every((s: unknown) => {
    if (typeof s !== 'object' || s === null) return false;
    const record = s as {
      name?: unknown;
      joinedAt?: unknown;
      message?: unknown;
      department?: unknown;
    };
    const nameOk = record.name === null || typeof record.name === 'string';
    const joinedOk = record.joinedAt === undefined || typeof record.joinedAt === 'string';
    // A message is only valid alongside a non-empty name: never trust a payload
    // that would attribute words to an opted-out (anonymous) supporter.
    const messageOk =
      record.message === undefined ||
      (typeof record.message === 'string' &&
        typeof record.name === 'string' &&
        record.name.length > 0);
    const departmentOk =
      record.department === undefined || isSupporterDepartment(record.department);
    return nameOk && joinedOk && messageOk && departmentOk;
  });
}
