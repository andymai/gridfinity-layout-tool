import { isShown, localDay } from './schedule';

export interface LatestEntry {
  readonly id: string;
  readonly showFrom?: string;
}

/**
 * The newest entries, newest first, down to the newest one with no start date,
 * duplicated as literals so the badge can answer "is there anything unseen"
 * without pulling `entries.ts` into the eager bundle: the full list is ~10kB
 * gzipped and most sessions never open it.
 *
 * `latest.test.ts` asserts this matches the head of `WHATS_NEW_ENTRIES`, so the
 * duplication cannot drift past CI or the pre-commit check.
 */
export const LATEST_ENTRIES: readonly LatestEntry[] = [
  { id: 'your-2026', showFrom: '2026-12-01' },
  { id: 'cutout-cradle' },
];

/**
 * The newest entry shown today. A scheduled entry counts only from its start
 * date, so marking everything seen before then cannot swallow it.
 */
export function latestEntryId(day: string = localDay()): string {
  return LATEST_ENTRIES.find((entry) => isShown(entry.showFrom, day))?.id ?? '';
}

/**
 * True when `seenId` is the newest shown entry, or a scheduled one newer than
 * it, as a clock set ahead and then corrected can leave behind.
 */
export function isCaughtUp(seenId: string, day: string = localDay()): boolean {
  const latest = latestEntryId(day);
  if (seenId === latest) return true;
  const seen = LATEST_ENTRIES.findIndex((entry) => entry.id === seenId);
  return seen !== -1 && seen < LATEST_ENTRIES.findIndex((entry) => entry.id === latest);
}
