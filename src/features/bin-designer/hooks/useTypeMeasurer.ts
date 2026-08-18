/**
 * Subscribe a preview to the designer's font registry.
 *
 * Returns the shared measurer once every requested face has registered, and
 * `null` until then. Null rather than a partial measurer on purpose: a plan
 * built against a face that has not arrived reports a size and a position that
 * no geometry will honour, and a preview drawn from it is worse than no preview.
 */

import { useEffect, useSyncExternalStore } from 'react';
import type { TextFontFamily } from '@/shared/types/bin';
import type { TypeMeasurer } from '@/shared/utils/typePlan';
import {
  areTypeFontsLoaded,
  ensureTypeFonts,
  getTypeMeasurer,
  subscribeTypeFonts,
  typeFontsVersion,
} from '@/features/bin-designer/utils/typeMeasurer';

export function useTypeMeasurer(families: readonly TextFontFamily[]): TypeMeasurer | null {
  // Identity of the array changes every render; the SET of faces is what the
  // effect actually depends on.
  const key = [...families].sort().join(',');
  useSyncExternalStore(subscribeTypeFonts, typeFontsVersion, () => 0);

  useEffect(() => {
    ensureTypeFonts(key === '' ? [] : (key.split(',') as TextFontFamily[]));
  }, [key]);

  return areTypeFontsLoaded(families) ? getTypeMeasurer() : null;
}
