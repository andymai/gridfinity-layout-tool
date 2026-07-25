import { useMemo } from 'react';
import type { Bin } from '@/core/types';
import { computeGhost, getLabelSuggestions } from '@/features/bin-inspector/labelSuggest';
import type {
  LabelGhost,
  LabelSuggestion,
  LabelSuggesterModel,
} from '@/features/bin-inspector/labelSuggest';

export interface LabelSuggestionsResult {
  suggestions: LabelSuggestion[];
  ghost: LabelGhost | null;
}

/**
 * Ranked label suggestions for a bin, derived from the current layout. The
 * live field text (`bin.label`) doubles as the query, so this recomputes as the
 * user types. On-device — no network. An optional trained model adds a learned
 * cross-user prior; heuristics alone run while it's null.
 */
export function useLabelSuggestions(
  bin: Bin,
  bins: readonly Bin[],
  maxLength?: number,
  model?: LabelSuggesterModel | null
): LabelSuggestionsResult {
  return useMemo(() => {
    const suggestions = getLabelSuggestions(bin.label, { target: bin, bins }, { maxLength, model });
    return { suggestions, ghost: computeGhost(bin.label, suggestions) };
  }, [bin, bins, maxLength, model]);
}
