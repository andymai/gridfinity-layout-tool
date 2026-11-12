import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActionHandlers } from './commandPaletteActionHandlers';
import { useHalfGridModeStore, useLayoutStore, useToastStore } from '@/core/store';
import { gridUnits, heightUnits } from '@/core/types';
import { resetAllStores, getBinId } from '@/test/testUtils';

describe('useActionHandlers', () => {
  beforeEach(() => {
    resetAllStores();
  });

  describe('toggle-half-bin', () => {
    it('opens the shared turn-off dialog, not a toast, when a bin sits on a half unit', () => {
      useHalfGridModeStore.getState().setHalfGridMode(true);
      const { layout, addBin } = useLayoutStore.getState();
      const id = getBinId(
        addBin({
          layerId: layout.layers[0].id,
          x: gridUnits(0.5),
          y: gridUnits(0),
          width: gridUnits(1),
          depth: gridUnits(1),
          height: heightUnits(3),
          category: layout.categories[0].id,
          label: '',
          notes: '',
        })
      );
      const { result } = renderHook(() => useActionHandlers());

      act(() => {
        result.current['toggle-half-bin']?.();
      });

      expect(useHalfGridModeStore.getState().halfGridMode).toBe(true);
      expect(useHalfGridModeStore.getState().blockedViolation).toEqual({
        type: 'fractional_bins_exist',
        binIds: [id],
        count: 1,
      });
      expect(useToastStore.getState().toasts).toEqual([]);
    });

    it('turns the mode on', () => {
      const { result } = renderHook(() => useActionHandlers());

      act(() => {
        result.current['toggle-half-bin']?.();
      });

      expect(useHalfGridModeStore.getState().halfGridMode).toBe(true);
    });
  });
});
