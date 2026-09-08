import { useCallback } from 'react';
import { batch } from '@/core/cqrs';
import { useLayoutStore } from '@/core/store';
import { useMutations } from '@/shared/contexts';

/**
 * Writer behind every `GridUnitInput`, so the drawer sidebar, the mobile panel
 * and the baseplate panel commit a pitch edit identically.
 *
 * `y === undefined` means a square grid and clears the stored Y pitch. Each
 * write is guarded so a no-op edit (re-committing the linked X input) emits no
 * undo entry or analytics event, and the pair is batched so unlinking — which
 * moves both axes at once — is a single undo step.
 */
export function useGridUnitChange(): (x: number, y?: number) => void {
  const { setGridUnitMm, setGridUnitMmY } = useMutations();
  return useCallback(
    (x: number, y?: number) => {
      const current = useLayoutStore.getState().layout;
      const xChanged = x !== (current.gridUnitMm as number);
      const yChanged = y !== (current.gridUnitMmY as number | undefined);
      if (!xChanged && !yChanged) return;
      batch(() => {
        if (xChanged) setGridUnitMm(x);
        if (yChanged) setGridUnitMmY(y ?? null);
      });
    },
    [setGridUnitMm, setGridUnitMmY]
  );
}
