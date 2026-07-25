import { EMPTY_MODEL, type LabelSuggesterModel } from './model';

let modelPromise: Promise<LabelSuggesterModel> | null = null;

/**
 * Lazily load the committed model.json (code-split into its own chunk). Cached
 * after the first call; a transient failure clears the cache so it can retry,
 * and always resolves — falling back to the inert EMPTY_MODEL.
 */
export function loadLabelSuggesterModel(): Promise<LabelSuggesterModel> {
  if (!modelPromise) {
    modelPromise = import('./labelSuggester.model.json')
      .then((m): LabelSuggesterModel => m.default)
      .catch(() => {
        modelPromise = null;
        return EMPTY_MODEL;
      });
  }
  return modelPromise;
}
