import { useEffect, useState } from 'react';
import { loadLabelSuggesterModel } from '@/features/bin-inspector/labelSuggest/loadModel';
import type { LabelSuggesterModel } from '@/features/bin-inspector/labelSuggest/model';

/**
 * Lazily loads the trained label-suggester model once and returns it, or null
 * until it resolves. Ranking works from heuristics alone while null, then the
 * learned prior kicks in on the next render.
 */
export function useLabelSuggesterModel(): LabelSuggesterModel | null {
  const [model, setModel] = useState<LabelSuggesterModel | null>(null);
  useEffect(() => {
    let alive = true;
    void loadLabelSuggesterModel().then((loaded) => {
      if (alive) setModel(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);
  return model;
}
