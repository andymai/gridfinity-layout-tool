import type { LabelDomain } from '@/shared/analytics/labelVocabulary';

/**
 * Why a label is being suggested. Drives the muted reason tag shown next to
 * each suggestion. Ordered by priority when several signals apply at once
 * (see `pickReason`): a sequence continuation outranks a neighbor reuse, which
 * outranks a plain reuse, which outranks a semantic/domain match, which
 * outranks a bare catalog entry.
 */
export type SuggestionReason =
  'nextInSet' | 'matchesNeighbors' | 'usedBefore' | 'similar' | 'catalog';

export interface LabelSuggestion {
  /** Text inserted into the label field when this suggestion is accepted. */
  value: string;
  /** Dominant signal behind the suggestion. */
  reason: SuggestionReason;
  /**
   * Combined score. Orders suggestions only *within* a tier: literal (letter)
   * matches always sort ahead of meaning-only ones regardless of score, so a
   * higher score does not by itself mean an earlier position in the result.
   */
  score: number;
  /** For `usedBefore`: how many other bins already carry this label. */
  count?: number;
  /** Recognized vocabulary domain, when known. */
  domain?: LabelDomain | null;
}

/**
 * Minimal structural shape the engine needs from a bin. Kept free of the
 * branded `Bin`/`GridUnits` types so the engine is a pure function of plain
 * data and can be unit-tested without the layout factory.
 */
export interface SuggestionBin {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  layerId: string;
  category: string;
  label: string;
}

export interface SuggestionContext {
  /** The bin currently being labeled. */
  target: SuggestionBin;
  /** All bins in the active layout, including the target. */
  bins: readonly SuggestionBin[];
}

/** Inline ghost completion for the top prediction. */
export interface LabelGhost {
  /** The full label the ghost would insert on accept. */
  value: string;
  /** The part shown as grey inline text after the caret (value minus typed prefix). */
  completion: string;
}
