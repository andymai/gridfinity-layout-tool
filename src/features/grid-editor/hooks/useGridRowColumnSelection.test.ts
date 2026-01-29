import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGridRowColumnSelection } from '@/features/grid-editor/hooks/useGridRowColumnSelection';
import { useSelectionStore } from '@/core/store/selection';
import { resetAllStores } from '@/test/testUtils';
import type { Bin } from '@/core/types';

describe('useGridRowColumnSelection', () => {
  beforeEach(() => {
    resetAllStores();
  });

  const createBin = (id: string, x: number, y: number, width = 1, depth = 1): Bin => ({
    id,
    layerId: 'layer1',
    x,
    y,
    width,
    depth,
    height: 3,
    category: 'coral',
    label: '',
    notes: '',
  });

  const createMouseEvent = (overrides: Partial<React.MouseEvent> = {}): React.MouseEvent => {
    return {
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      ...overrides,
    } as React.MouseEvent;
  };

  describe('handleRowClick', () => {
    it('selects bins in the clicked row', () => {
      const bins = [createBin('bin1', 0, 0), createBin('bin2', 1, 0), createBin('bin3', 0, 1)];

      const { result } = renderHook(() =>
        useGridRowColumnSelection({ bins, activeLayerId: 'layer1' })
      );

      act(() => {
        // Row 1 is y=0 (1-indexed row numbers)
        result.current.handleRowClick(1, createMouseEvent());
      });

      expect(useSelectionStore.getState().selectedBinIds).toEqual(['bin1', 'bin2']);
    });

    it('supports shift-click range selection', () => {
      const bins = [createBin('bin1', 0, 0), createBin('bin2', 0, 1), createBin('bin3', 0, 2)];

      const { result } = renderHook(() =>
        useGridRowColumnSelection({ bins, activeLayerId: 'layer1' })
      );

      // Click row 1 first
      act(() => {
        result.current.handleRowClick(1, createMouseEvent());
      });

      // Shift-click row 3
      act(() => {
        result.current.handleRowClick(3, createMouseEvent({ shiftKey: true }));
      });

      // Should select bins in rows 1-3
      expect(useSelectionStore.getState().selectedBinIds).toContain('bin1');
      expect(useSelectionStore.getState().selectedBinIds).toContain('bin2');
      expect(useSelectionStore.getState().selectedBinIds).toContain('bin3');
    });
  });

  describe('handleColumnClick', () => {
    it('selects bins in the clicked column', () => {
      const bins = [createBin('bin1', 0, 0), createBin('bin2', 0, 1), createBin('bin3', 1, 0)];

      const { result } = renderHook(() =>
        useGridRowColumnSelection({ bins, activeLayerId: 'layer1' })
      );

      act(() => {
        // Column 1 is x=0 (1-indexed)
        result.current.handleColumnClick(1, createMouseEvent());
      });

      expect(useSelectionStore.getState().selectedBinIds).toEqual(['bin1', 'bin2']);
    });
  });

  describe('layer change resets shift-click anchor', () => {
    it('resets row anchor when activeLayerId changes', () => {
      const layer1Bins = [createBin('bin1', 0, 0, 1, 1), createBin('bin2', 0, 2, 1, 1)];
      const layer2Bins = [
        { ...createBin('bin3', 0, 0, 1, 1), layerId: 'layer2' },
        { ...createBin('bin4', 0, 4, 1, 1), layerId: 'layer2' },
      ];
      const allBins = [...layer1Bins, ...layer2Bins];

      const { result, rerender } = renderHook(
        ({ activeLayerId }) => useGridRowColumnSelection({ bins: allBins, activeLayerId }),
        { initialProps: { activeLayerId: 'layer1' } }
      );

      // Click row 1 on layer1 to set anchor
      act(() => {
        result.current.handleRowClick(1, createMouseEvent());
      });

      // Switch to layer2
      rerender({ activeLayerId: 'layer2' });

      // Shift-click row 5 on layer2 — anchor should have been reset
      // so this should be a normal click (no shift range from old layer)
      act(() => {
        result.current.handleRowClick(5, createMouseEvent({ shiftKey: true }));
      });

      // With anchor reset, shift-click without prior anchor does normal selection
      // (only bins in row 5, not a range from row 1)
      const selected = useSelectionStore.getState().selectedBinIds;
      expect(selected).toContain('bin4');
      expect(selected).not.toContain('bin1');
      expect(selected).not.toContain('bin2');
    });

    it('resets column anchor when activeLayerId changes', () => {
      const layer1Bins = [createBin('bin1', 0, 0, 1, 1), createBin('bin2', 2, 0, 1, 1)];
      const layer2Bins = [
        { ...createBin('bin3', 0, 0, 1, 1), layerId: 'layer2' },
        { ...createBin('bin4', 4, 0, 1, 1), layerId: 'layer2' },
      ];
      const allBins = [...layer1Bins, ...layer2Bins];

      const { result, rerender } = renderHook(
        ({ activeLayerId }) => useGridRowColumnSelection({ bins: allBins, activeLayerId }),
        { initialProps: { activeLayerId: 'layer1' } }
      );

      // Click column 1 on layer1 to set anchor
      act(() => {
        result.current.handleColumnClick(1, createMouseEvent());
      });

      // Switch to layer2
      rerender({ activeLayerId: 'layer2' });

      // Shift-click column 5 on layer2 — anchor should have been reset
      act(() => {
        result.current.handleColumnClick(5, createMouseEvent({ shiftKey: true }));
      });

      // With anchor reset, shift-click without prior anchor does normal selection
      const selected = useSelectionStore.getState().selectedBinIds;
      expect(selected).toContain('bin4');
      expect(selected).not.toContain('bin1');
      expect(selected).not.toContain('bin2');
    });
  });
});
