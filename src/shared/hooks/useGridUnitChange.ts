import { useCallback } from 'react';
import { batch } from '@/core/cqrs';
import { useLayoutStore } from '@/core/store';
import { useMutations } from '@/shared/contexts';

/**
 * Writer behind every `GridUnitInput`. `y === undefined` means a square grid
 * and clears the stored Y pitch.
 *
 * The guard keeps a no-op commit — re-blurring an untouched input — from
 * spending an undo entry, and the batch makes an unlinked X+Y edit one step.
 *
 * The two writes are ORDERED, because each axis's clamp reads the other's
 * stored value and the two directions want opposite orders. A square grid's X
 * floor covers the Y bound as well (`gridPitchFloors`), so unlinking has to
 * store Y first or X clamps against a floor that only applied while the axes
 * were tied. Relinking is the mirror: `setGridUnitMmY(null)` refuses to collapse
 * onto an X that would leave a custom outline overhanging, so X has to land
 * first for that check to see the value being collapsed onto.
 */
export function useGridUnitChange(): (x: number, y?: number) => void {
  const { setGridUnitMm, setGridUnitMmY } = useMutations();
  return useCallback(
    (x: number, y?: number) => {
      const current = useLayoutStore.getState().layout;
      const xChanged = x !== (current.gridUnitMm as number);
      const yChanged = y !== (current.gridUnitMmY as number | undefined);
      if (!xChanged && !yChanged) return;
      const writeX = (): void => {
        if (xChanged) setGridUnitMm(x);
      };
      const writeY = (): void => {
        if (yChanged) setGridUnitMmY(y ?? null);
      };
      batch(() => {
        if (y === undefined) {
          writeX();
          writeY();
        } else {
          writeY();
          writeX();
        }
      });
    },
    [setGridUnitMm, setGridUnitMmY]
  );
}
