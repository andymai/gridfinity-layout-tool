import type { Locale } from '@/i18n/types';
import type { LocalizedText, WhatsNewEntry } from './types';

/** Longest digest shown before the rest moves behind the archive view. */
export const DIGEST_LIMIT = 5;

export function resolveText(text: LocalizedText, locale: Locale): string {
  return text[locale] ?? text.en;
}

/**
 * `unseen` means the list is exactly what shipped since the user last looked.
 * `recent` means it is the newest few shown for context, either because they
 * are caught up or because their marker is no longer in the list. The caller
 * needs the distinction: only `unseen` may be described as a count of what
 * they missed.
 */
export type DigestKind = 'unseen' | 'recent';

export interface Digest {
  entries: WhatsNewEntry[];
  kind: DigestKind;
}

export function buildDigest(entries: WhatsNewEntry[], lastSeenId: string): Digest {
  const index = entries.findIndex((entry) => entry.id === lastSeenId);
  if (index <= 0) return { entries: entries.slice(0, DIGEST_LIMIT), kind: 'recent' };
  return { entries: entries.slice(0, index), kind: 'unseen' };
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
