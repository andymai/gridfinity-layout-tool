import { useCallback } from 'react';
import type { BaseConfig } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';

/**
 * Why the magnet chamfer cannot open on this base, as a translation key. The
 * lead-in needs wall around the hole: a lightweight base keeps only a thin
 * pad and nesting magnets sit in bosses, so both keep the plain mouth and
 * the control says so instead of silently doing nothing.
 */
function chamferBlockerKey(base: BaseConfig, nesting: boolean): string | null {
  if (base.lightweight) return 'binDesigner.base.magnetChamferLightweight';
  if (nesting) return 'binDesigner.base.magnetChamferNesting';
  return null;
}

export function useMagnetPressFit(
  base: BaseConfig,
  nesting: boolean,
  updateBase: (partial: Partial<BaseConfig>) => void
): {
  readonly crushRibs: boolean;
  readonly chamfer: boolean;
  readonly chamferUnavailable: string | undefined;
  readonly setCrushRibs: (on: boolean) => void;
  readonly setChamfer: (on: boolean) => void;
} {
  const t = useTranslation();
  const blocker = chamferBlockerKey(base, nesting);
  // Off is absence, not `false`, so an untouched design hashes the same.
  const setCrushRibs = useCallback(
    (on: boolean) => updateBase({ magnetCrushRibs: on || undefined }),
    [updateBase]
  );
  const setChamfer = useCallback(
    (on: boolean) => updateBase({ magnetChamfer: on || undefined }),
    [updateBase]
  );
  return {
    crushRibs: base.magnetCrushRibs === true,
    chamfer: base.magnetChamfer === true,
    chamferUnavailable: blocker ? t(blocker) : undefined,
    setCrushRibs,
    setChamfer,
  };
}
