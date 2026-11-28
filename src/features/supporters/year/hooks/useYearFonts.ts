import { useEffect, useState } from 'react';
import { canLoadFonts, loadYearFonts } from '../look/fonts';
import { createMeasure, type Measure } from '../look/typeset';

/**
 * Loads the faces the story's text needs, then hands out a measure that
 * reads them. Text wrapped before its face loads would wrap against a
 * fallback, so the story waits (briefly, with a limit) for the first load.
 * Text that changes later, such as a triangle count that arrives with its
 * mesh, loads behind the playing story and never takes it back to waiting.
 * Where fonts cannot load at all, the story starts at once on the fallbacks.
 */
export function useYearFonts(sample: string | null): {
  readonly ready: boolean;
  readonly measure: Measure;
} {
  const [fallback] = useState(createMeasure);
  // A fresh measure after each load, so its cache holds no fallback widths.
  const [loaded, setLoaded] = useState<Measure | null>(null);
  useEffect(() => {
    if (sample === null || !canLoadFonts()) return;
    let cancelled = false;
    void loadYearFonts(sample).then(() => {
      if (!cancelled) setLoaded(() => createMeasure());
    });
    return () => {
      cancelled = true;
    };
  }, [sample]);
  if (!canLoadFonts()) return { ready: sample !== null, measure: fallback };
  return { ready: sample !== null && loaded !== null, measure: loaded ?? fallback };
}
