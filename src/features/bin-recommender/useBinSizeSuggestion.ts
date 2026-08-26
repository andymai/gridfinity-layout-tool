import { useEffect, useMemo, useState } from 'react';
import { useRetryOnReconnect } from '@/shared/hooks/useRetryOnReconnect';
import { loadBinRecommenderModel } from './loadModel';
import { recommendBinSize, type DrawerDims } from './recommender';
import type { BinRecommenderModel, BinSize, BinSizePrediction } from './types';

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
  const [model, setModel] = useState<BinRecommenderModel | null>(null);
  const [failed, setFailed] = useState(false);
  // The asset is fetched on demand, not precached, so a first request made
  // offline fails. Without this the effect never runs again and suggestions stay
  // dark for the rest of the session.
  const attempt = useRetryOnReconnect(failed);

  useEffect(() => {
    let cancelled = false;
    loadBinRecommenderModel()
      .then((m) => {
        if (cancelled) return;
        setModel(m);
        setFailed(false);
      })
      .catch(() => {
        // A missing/broken model asset just means no suggestions — stay silent.
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const trimmed = label.trim();
  const { width: dw, depth: dd, height: dh } = drawer;
  const { width: cw, depth: cd, height: ch } = current;

  return useMemo(() => {
    if (!model || !trimmed) return null;

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
  }, [model, trimmed, dw, dd, dh, cw, cd, ch]);
}
