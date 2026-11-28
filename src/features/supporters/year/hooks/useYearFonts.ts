import { useEffect, useState } from 'react';
import { canLoadFonts, loadYearFonts } from '../look/fonts';
import { createMeasure, type Measure } from '../look/typeset';

interface Loaded {
  readonly sample: string;
  /** Made after the faces are in, so its cache holds no fallback widths. */
  readonly measure: Measure;
}

/**
 * Loads the faces the story's text needs, then hands out a measure that
 * reads them. Text wrapped before its face loads would wrap against a
 * fallback, so the story waits (briefly, with a limit) for `ready`. Where
 * fonts cannot load at all, the story starts at once on the fallbacks.
 */
export function useYearFonts(sample: string | null): {
  readonly ready: boolean;
  readonly measure: Measure;
} {
  const [fallback] = useState(createMeasure);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    if (sample === null || !canLoadFonts()) return;
    let cancelled = false;
    void loadYearFonts(sample).then(() => {
      if (!cancelled) setLoaded({ sample, measure: createMeasure() });
    });
    return () => {
      cancelled = true;
    };
  }, [sample]);
  if (!canLoadFonts()) return { ready: sample !== null, measure: fallback };
  if (sample !== null && loaded?.sample === sample) return { ready: true, measure: loaded.measure };
  return { ready: false, measure: fallback };
}
