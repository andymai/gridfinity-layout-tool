import type { Locale } from '@/i18n/types';
import type { LocalizedText, WhatsNewEntry, WhatsNewKind } from './types';

/** Longest digest shown before the rest moves behind the archive view. */
export const DIGEST_LIMIT = 5;

/**
 * Ceiling on a genuine unseen list, which is otherwise unbounded: a user away
 * for three weeks would auto-open a modal holding sixty entries. The remainder
 * is not dropped, it moves behind the digest's overflow row.
 */
export const DIGEST_MAX = 8;

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
  /** How many unseen entries exist in total, including those past `DIGEST_MAX`. */
  total: number;
}

export function buildDigest(entries: WhatsNewEntry[], lastSeenId: string): Digest {
  const index = entries.findIndex((entry) => entry.id === lastSeenId);
  if (index <= 0) {
    return { entries: entries.slice(0, DIGEST_LIMIT), kind: 'recent', total: entries.length };
  }
  return { entries: entries.slice(0, Math.min(index, DIGEST_MAX)), kind: 'unseen', total: index };
}

export interface DigestLead {
  /** Promoted to the lead card, or null when nothing in range is featured. */
  headline: WhatsNewEntry | null;
  rest: WhatsNewEntry[];
}

export function splitLead(entries: WhatsNewEntry[]): DigestLead {
  const headline = entries.find((entry) => entry.featured === true) ?? null;
  if (headline === null) return { headline: null, rest: entries };
  return { headline, rest: entries.filter((entry) => entry !== headline) };
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

export interface KindGroup {
  kind: WhatsNewKind;
  entries: WhatsNewEntry[];
}

/** Section order, most to least consequential to someone catching up. */
const KIND_ORDER: readonly WhatsNewKind[] = ['new', 'improved', 'fixed'];

/**
 * Fixed section order rather than order of appearance, so the digest reads the
 * same shape every time it opens and the sections stay a stable landmark.
 */
export function groupByKind(entries: WhatsNewEntry[]): KindGroup[] {
  return KIND_ORDER.map((kind) => ({
    kind,
    entries: entries.filter((entry) => (entry.kind ?? 'new') === kind),
  })).filter((group) => group.entries.length > 0);
}

export function countByKind(entries: WhatsNewEntry[], kind: WhatsNewKind): number {
  return entries.filter((entry) => (entry.kind ?? 'new') === kind).length;
}
