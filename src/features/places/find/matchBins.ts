import type { BinId, LayerId, LayoutId } from '@/core/types';
import { conceptOf, tokenize } from './searchText';

export type SearchFieldKind = 'item' | 'label' | 'note';

export interface SearchField {
  readonly kind: SearchFieldKind;
  readonly text: string;
  readonly tokens: readonly string[];
  readonly concept: string | null;
}

export interface BinSearchRecord {
  readonly layoutId: LayoutId;
  readonly binId: BinId;
  readonly layerId: LayerId;
  /** Null for a bin in the stash. */
  readonly layerName: string | null;
  readonly label: string;
  readonly fields: readonly SearchField[];
}

export interface BinMatch {
  readonly record: BinSearchRecord;
  readonly field: SearchField;
  readonly score: number;
}

/** Small enough that a whole word in a note still beats a prefix in a label. */
const FIELD_BONUS: Record<SearchFieldKind, number> = { item: 0.3, label: 0.3, note: 0 };

/** Below any word hit, prefixes included, in the same kind of field. */
const CONCEPT_SCORE = 0.4;

export function searchField(kind: SearchFieldKind, text: string): SearchField {
  return { kind, text, tokens: tokenize(text), concept: conceptOf(text) };
}

/** Every query word must start some field word; whole words score above prefixes. 0 when one does not. */
function wordScore(query: readonly string[], field: readonly string[]): number {
  let total = 0;
  for (const word of query) {
    let best = 0;
    for (const candidate of field) {
      if (candidate === word) {
        best = 2;
        break;
      }
      if (candidate.startsWith(word)) best = 1;
    }
    if (best === 0) return 0;
    total += best;
  }
  return total / (2 * query.length);
}

export function matchBins(
  query: string,
  records: readonly BinSearchRecord[],
  limit = 8
): BinMatch[] {
  const words = tokenize(query);
  if (words.length === 0) return [];
  // A concept stands for the whole query, so a qualifier ("m3 screws") would be dropped.
  const concept = words.length === 1 ? conceptOf(query) : null;

  const matches: BinMatch[] = [];
  for (const record of records) {
    let best: BinMatch | null = null;
    for (const field of record.fields) {
      const wordHit = wordScore(words, field.tokens);
      const raw =
        wordHit > 0 ? wordHit : concept !== null && field.concept === concept ? CONCEPT_SCORE : 0;
      const score = raw > 0 ? raw + FIELD_BONUS[field.kind] : 0;
      if (score > 0 && (!best || score > best.score)) best = { record, field, score };
    }
    if (best) matches.push(best);
  }

  matches.sort((a, b) => b.score - a.score || a.field.text.length - b.field.text.length);
  return matches.slice(0, limit);
}
