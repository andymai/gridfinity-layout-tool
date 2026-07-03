import { useEffect, useMemo, useState } from 'react';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { recommendBinSize, type DrawerDims } from './recommender';
import type { BinRecommenderModel, BinSize, BinSizePrediction } from './types';

// The model is ~600KB, so it is dynamically imported and only fetched once the
// Labs flag is on. The promise is module-level so multiple mounts share one load.
let modelPromise: Promise<BinRecommenderModel> | null = null;
function loadModel(): Promise<BinRecommenderModel> {
  if (!modelPromise) {
    modelPromise = import('./model.json')
      .then((m) => m.default as unknown as BinRecommenderModel)
      .catch((err: unknown) => {
        // Don't cache a rejected promise — a transient chunk-fetch failure
        // would otherwise disable suggestions for the rest of the session.
        modelPromise = null;
        throw err;
      });
  }
  return modelPromise;
}

/**
 * Suggest a bin size for a typed label, or `null` when there is nothing worth
 * showing. Only label/embed-tier hits surface — the drawer-prior fallback is
 * dominated by the trivial 1x1x3 default and would nag, so it is suppressed.
 * A suggestion that already matches the current size is also dropped.
 */
export function useBinSizeSuggestion(
  label: string,
  drawer: DrawerDims,
  current: BinSize
): BinSizePrediction | null {
  const enabled = useFeatureFlag('bin_recommender');
  const [model, setModel] = useState<BinRecommenderModel | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadModel()
      .then((m) => {
        if (!cancelled) setModel(m);
      })
      .catch(() => {
        // A missing/broken model chunk just means no suggestions — stay silent.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const trimmed = label.trim();
  const { width: dw, depth: dd, height: dh } = drawer;
  const { width: cw, depth: cd, height: ch } = current;

  return useMemo(() => {
    if (!enabled || !model || !trimmed) return null;

    const prediction = recommendBinSize({
      label: trimmed,
      drawer: { width: dw, depth: dd, height: dh },
      model,
    });
    if (!prediction || prediction.source === 'drawer') return null;

    if (
      prediction.size.width === cw &&
      prediction.size.depth === cd &&
      prediction.size.height === ch
    ) {
      return null;
    }
    return prediction;
  }, [enabled, model, trimmed, dw, dd, dh, cw, cd, ch]);
}
