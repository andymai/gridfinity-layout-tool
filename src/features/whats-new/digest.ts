import type { Locale } from '@/i18n/types';
import type { LocalizedText, WhatsNewEntry } from './types';

/** Longest digest shown before the rest moves behind the archive view. */
export const DIGEST_LIMIT = 5;

export function resolveText(text: LocalizedText, locale: Locale): string {
  return text[locale] ?? text.en;
}

/**
 * Entries newer than the last one the user saw. An unrecognised marker means
 * their position is no longer in the list, so fall back to the newest few
 * rather than replaying the entire history at them.
 */
export function getUnseenEntries(entries: WhatsNewEntry[], lastSeenId: string): WhatsNewEntry[] {
  const index = entries.findIndex((entry) => entry.id === lastSeenId);
  if (index === -1) return entries.slice(0, DIGEST_LIMIT);
  return entries.slice(0, index);
}

export interface EntryGroup {
  /** `YYYY-MM`, for both the sort order and the heading's date formatting. */
  month: string;
  entries: WhatsNewEntry[];
}

export function groupByMonth(entries: WhatsNewEntry[]): EntryGroup[] {
  const groups: EntryGroup[] = [];
  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    const last = groups.at(-1);
    if (last?.month === month) {
      last.entries.push(entry);
    } else {
      groups.push({ month, entries: [entry] });
    }
  }
  return groups;
}
