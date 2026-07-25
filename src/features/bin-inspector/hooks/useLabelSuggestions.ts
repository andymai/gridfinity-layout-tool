import { useMemo } from 'react';
import type { Bin } from '@/core/types';
import { computeGhost, getLabelSuggestions } from '@/features/bin-inspector/labelSuggest';
import type { LabelGhost, LabelSuggestion } from '@/features/bin-inspector/labelSuggest';

export interface LabelSuggestionsResult {
  suggestions: LabelSuggestion[];
  ghost: LabelGhost | null;
}

/**
 * Ranked label suggestions for a bin, derived from the current layout. The
 * live field text (`bin.label`) doubles as the query, so this recomputes as the
 * user types. Pure and on-device — no network, no model download.
 */
export function useLabelSuggestions(bin: Bin, bins: readonly Bin[]): LabelSuggestionsResult {
  return useMemo(() => {
    const suggestions = getLabelSuggestions(bin.label, { target: bin, bins });
    return { suggestions, ghost: computeGhost(bin.label, suggestions) };
  }, [bin, bins]);
}
