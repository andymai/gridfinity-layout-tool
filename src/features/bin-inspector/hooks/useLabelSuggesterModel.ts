import { useEffect, useState } from 'react';
import { loadLabelSuggesterModel } from '@/features/bin-inspector/labelSuggest/loadModel';
import { EMPTY_MODEL } from '@/features/bin-inspector/labelSuggest/model';
import type { LabelSuggesterModel } from '@/features/bin-inspector/labelSuggest/model';
import { useRetryOnReconnect } from '@/shared/hooks/useRetryOnReconnect';

/**
 * Lazily loads the trained label-suggester model once and returns it, or null
 * until it resolves. Ranking works from heuristics alone while null, then the
 * learned prior kicks in on the next render.
 */
export function useLabelSuggesterModel(): LabelSuggesterModel | null {
  const [model, setModel] = useState<LabelSuggesterModel | null>(null);
  const [failed, setFailed] = useState(false);
  // The asset is fetched on demand, not precached, so a first request made
  // offline falls back to the inert model. Identity (not `isModelUsable`)
  // distinguishes that from a legitimately untrained committed model, which is
  // also empty but is a distinct object parsed from JSON.
  const attempt = useRetryOnReconnect(failed);

  useEffect(() => {
    let alive = true;
    void loadLabelSuggesterModel().then((loaded) => {
      if (!alive) return;
      setModel(loaded);
      setFailed(loaded === EMPTY_MODEL);
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  return model;
}
