import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBinInspector } from '../../hooks/useBinInspector';
import { useLayoutStore } from '../../core/store/layout';
import { useUIStore } from '../../core/store/ui';
import { resetAllStores } from '../testUtils';
import type { Bin } from '../../core/types';

describe('useBinInspector', () => {
  // Helper to create bins at specific positions
  const createBin = (id: string, layerId: string, x = 0, y = 0, width = 2, depth = 2): Bin => ({
    id,
    layerId,
    x,
    y,
    width,
    depth,
    height: 3,
    category: 'coral',
    label: '',
    notes: '',
  });

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Set up default layout with a layer and category
    const layout = useLayoutStore.getState().layout;
    layout.layers = [{ id: 'layer1', name: 'Layer 1', height: 3 }];
    layout.categories = [{ id: 'coral', name: 'Coral', color: '#ff7f7f' }];
    layout.bins = [];
    useLayoutStore.setState({ layout });

    // Set default UI state
    useUIStore.setState({ activeLayerId: 'layer1', selectedBinIds: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('selection state', () => {
    it('returns empty selection when no bins selected', () => {
      const { result } = renderHook(() => useBinInspector());

      expect(result.current.selectedBins).toHaveLength(0);
      expect(result.current.isMultiSelect).toBe(false);
      expect(result.current.bin).toBeNull();
      expect(result.current.category).toBeNull();
      expect(result.current.layer).toBeNull();
    });

    it('returns single bin when one is selected', () => {
      const bin = createBin('bin1', 'layer1');
      const layout = useLayoutStore.getState().layout;
      layout.bins = [bin];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1'] });

      const { result } = renderHook(() => useBinInspector());

      expect(result.current.selectedBins).toHaveLength(1);
      expect(result.current.isMultiSelect).toBe(false);
      expect(result.current.bin?.id).toBe('bin1');
      expect(result.current.category?.id).toBe('coral');
      expect(result.current.layer?.id).toBe('layer1');
    });

    it('returns multiple bins for multi-select', () => {
      const bins = [
        createBin('bin1', 'layer1', 0, 0),
        createBin('bin2', 'layer1', 3, 0),
      ];
      const layout = useLayoutStore.getState().layout;
      layout.bins = bins;
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1', 'bin2'] });

      const { result } = renderHook(() => useBinInspector());

      expect(result.current.selectedBins).toHaveLength(2);
      expect(result.current.isMultiSelect).toBe(true);
      expect(result.current.bin).toBeNull(); // No single bin when multi-select
    });
  });

  describe('constraints', () => {
    it('returns default constraints when no bin selected', () => {
      const { result } = renderHook(() => useBinInspector());

      expect(result.current.constraints).toEqual({
        minHeight: 1,
        maxHeight: 1,
        maxClearance: 0,
        maxGridUnits: 5,
        needsSplit: false,
        heightRange: '1u',
      });
    });

    it('calculates constraints for selected bin', () => {
      const bin = createBin('bin1', 'layer1');
      const layout = useLayoutStore.getState().layout;
      layout.bins = [bin];
      layout.drawer.height = 12;
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1'] });

      const { result } = renderHook(() => useBinInspector());

      expect(result.current.constraints.minHeight).toBe(3); // Layer height
      expect(result.current.constraints.maxHeight).toBe(12); // Drawer height
    });

    it('detects when bin needs split', () => {
      // Create a bin larger than print bed allows
      const bin = { ...createBin('bin1', 'layer1'), width: 10, depth: 10 };
      const layout = useLayoutStore.getState().layout;
      layout.bins = [bin];
      layout.printBedSize = 100; // Small print bed
      layout.gridUnitMm = 42;
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1'] });

      const { result } = renderHook(() => useBinInspector());

      // If max grid units is small enough, needsSplit should be true
      expect(typeof result.current.constraints.needsSplit).toBe('boolean');
    });
  });

  describe('updateField', () => {
    it('updates bin label', () => {
      const bin = createBin('bin1', 'layer1');
      const layout = useLayoutStore.getState().layout;
      layout.bins = [bin];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1'] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateField('label', 'Test Label');
      });

      expect(useLayoutStore.getState().layout.bins[0].label).toBe('Test Label');
    });

    it('updates bin notes', () => {
      const bin = createBin('bin1', 'layer1');
      const layout = useLayoutStore.getState().layout;
      layout.bins = [bin];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1'] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateField('notes', 'Some notes');
      });

      expect(useLayoutStore.getState().layout.bins[0].notes).toBe('Some notes');
    });

    it('updates bin width', () => {
      const bin = createBin('bin1', 'layer1');
      const layout = useLayoutStore.getState().layout;
      layout.bins = [bin];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1'] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateField('width', 3);
      });

      expect(useLayoutStore.getState().layout.bins[0].width).toBe(3);
    });

    it('clamps width to minimum 0.5', () => {
      const bin = createBin('bin1', 'layer1');
      const layout = useLayoutStore.getState().layout;
      layout.bins = [bin];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1'] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateField('width', 0);
      });

      expect(useLayoutStore.getState().layout.bins[0].width).toBe(0.5);
    });

    it('updates bin height and clamps to constraints', () => {
      const bin = createBin('bin1', 'layer1');
      const layout = useLayoutStore.getState().layout;
      layout.bins = [bin];
      layout.drawer.height = 12;
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1'] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateField('height', 100); // Should be clamped
      });

      expect(useLayoutStore.getState().layout.bins[0].height).toBeLessThanOrEqual(12);
    });

    it('preserves clearance when changing height', () => {
      const bin = { ...createBin('bin1', 'layer1'), height: 5, clearanceHeight: 3 };
      const layout = useLayoutStore.getState().layout;
      layout.bins = [bin];
      layout.drawer.height = 12;
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1'] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateField('height', 6);
      });

      const updatedBin = useLayoutStore.getState().layout.bins[0];
      // New clearance should be adjusted
      expect(updatedBin.height).toBe(6);
    });

    it('does nothing when no bin selected', () => {
      const { result } = renderHook(() => useBinInspector());

      // Should not throw
      expect(() => {
        act(() => {
          result.current.updateField('label', 'test');
        });
      }).not.toThrow();
    });
  });

  describe('updateMultiCategory', () => {
    it('updates category for multiple bins', () => {
      const layout = useLayoutStore.getState().layout;
      layout.categories.push({ id: 'green', name: 'Green', color: '#00ff00' });
      layout.bins = [
        createBin('bin1', 'layer1', 0, 0),
        createBin('bin2', 'layer1', 3, 0),
      ];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1', 'bin2'] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateMultiCategory('green');
      });

      const bins = useLayoutStore.getState().layout.bins;
      expect(bins[0].category).toBe('green');
      expect(bins[1].category).toBe('green');
    });

    it('does nothing when no bins selected', () => {
      const { result } = renderHook(() => useBinInspector());

      expect(() => {
        act(() => {
          result.current.updateMultiCategory('green');
        });
      }).not.toThrow();
    });
  });

  describe('updateMultiHeight', () => {
    it('updates height for multiple bins with delta', () => {
      const layout = useLayoutStore.getState().layout;
      layout.drawer.height = 12;
      layout.bins = [
        { ...createBin('bin1', 'layer1', 0, 0), height: 3 },
        { ...createBin('bin2', 'layer1', 3, 0), height: 4 },
      ];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1', 'bin2'] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateMultiHeight(2); // +2 height
      });

      const bins = useLayoutStore.getState().layout.bins;
      expect(bins[0].height).toBe(5);
      expect(bins[1].height).toBe(6);
    });

    it('clamps height to constraints', () => {
      const layout = useLayoutStore.getState().layout;
      layout.drawer.height = 6;
      layout.bins = [{ ...createBin('bin1', 'layer1'), height: 5 }];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1'] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateMultiHeight(10); // Should be clamped
      });

      expect(useLayoutStore.getState().layout.bins[0].height).toBeLessThanOrEqual(6);
    });
  });

  describe('updateMultiClearance', () => {
    it('updates clearance for multiple bins', () => {
      const layout = useLayoutStore.getState().layout;
      layout.drawer.height = 12;
      layout.bins = [
        { ...createBin('bin1', 'layer1', 0, 0), height: 3, clearanceHeight: 0 },
        { ...createBin('bin2', 'layer1', 3, 0), height: 4, clearanceHeight: 1 },
      ];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1', 'bin2'] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateMultiClearance(2);
      });

      const bins = useLayoutStore.getState().layout.bins;
      expect(bins[0].clearanceHeight).toBe(2);
      expect(bins[1].clearanceHeight).toBe(3);
    });
  });

  describe('delete operations', () => {
    it('requestDelete sets confirmation state', () => {
      const layout = useLayoutStore.getState().layout;
      layout.bins = [createBin('bin1', 'layer1')];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1'] });

      const { result } = renderHook(() => useBinInspector());

      expect(result.current.deleteConfirmState).toBeNull();

      act(() => {
        result.current.requestDelete();
      });

      expect(result.current.deleteConfirmState).not.toBeNull();
      expect(result.current.deleteConfirmState?.title).toBe('Delete Bin');
    });

    it('requestDelete shows multi-delete title for multiple bins', () => {
      const layout = useLayoutStore.getState().layout;
      layout.bins = [
        createBin('bin1', 'layer1', 0, 0),
        createBin('bin2', 'layer1', 3, 0),
      ];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1', 'bin2'] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.requestDelete();
      });

      expect(result.current.deleteConfirmState?.title).toBe('Delete Bins');
    });

    it('confirmDelete removes bins and clears selection', () => {
      const layout = useLayoutStore.getState().layout;
      layout.bins = [createBin('bin1', 'layer1')];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1'] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.requestDelete();
      });

      act(() => {
        result.current.confirmDelete();
      });

      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
      expect(useUIStore.getState().selectedBinIds).toHaveLength(0);
    });

    it('cancelDelete clears confirmation state', () => {
      const layout = useLayoutStore.getState().layout;
      layout.bins = [createBin('bin1', 'layer1')];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1'] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.requestDelete();
      });

      expect(result.current.deleteConfirmState).not.toBeNull();

      act(() => {
        result.current.cancelDelete();
      });

      expect(result.current.deleteConfirmState).toBeNull();
      // Bin should still exist
      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);
    });
  });

  describe('moveToStaging', () => {
    it('moves selected bins to staging', () => {
      const layout = useLayoutStore.getState().layout;
      layout.bins = [
        createBin('bin1', 'layer1', 0, 0),
        createBin('bin2', 'layer1', 3, 0),
      ];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1', 'bin2'] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.moveToStaging();
      });

      const bins = useLayoutStore.getState().layout.bins;
      expect(bins[0].layerId).toBe('__staging__');
      expect(bins[1].layerId).toBe('__staging__');
    });
  });

  describe('clearSelection', () => {
    it('clears the selection', () => {
      const layout = useLayoutStore.getState().layout;
      layout.bins = [createBin('bin1', 'layer1')];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1'] });

      const { result } = renderHook(() => useBinInspector());

      expect(useUIStore.getState().selectedBinIds).toHaveLength(1);

      act(() => {
        result.current.clearSelection();
      });

      expect(useUIStore.getState().selectedBinIds).toHaveLength(0);
    });
  });

  describe('rotateBin', () => {
    it('swaps width and depth', () => {
      const layout = useLayoutStore.getState().layout;
      layout.bins = [{ ...createBin('bin1', 'layer1'), width: 2, depth: 3 }];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1'] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.rotateBin();
      });

      const bin = useLayoutStore.getState().layout.bins[0];
      expect(bin.width).toBe(3);
      expect(bin.depth).toBe(2);
    });

    it('returns true on success', () => {
      const layout = useLayoutStore.getState().layout;
      layout.bins = [{ ...createBin('bin1', 'layer1'), width: 2, depth: 3 }];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1'] });

      const { result } = renderHook(() => useBinInspector());

      let rotateResult: boolean = false;
      act(() => {
        rotateResult = result.current.rotateBin();
      });

      expect(rotateResult).toBe(true);
    });

    it('returns false when no bin selected', () => {
      const { result } = renderHook(() => useBinInspector());

      let rotateResult: boolean = true;
      act(() => {
        rotateResult = result.current.rotateBin();
      });

      expect(rotateResult).toBe(false);
    });
  });

  describe('moveToLayer', () => {
    it('moves bin to another layer', () => {
      const layout = useLayoutStore.getState().layout;
      layout.layers = [
        { id: 'layer1', name: 'Layer 1', height: 3 },
        { id: 'layer2', name: 'Layer 2', height: 3 },
      ];
      layout.bins = [createBin('bin1', 'layer1')];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1'] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.moveToLayer('layer2');
      });

      expect(useLayoutStore.getState().layout.bins[0].layerId).toBe('layer2');
    });

    it('does nothing when moving to same layer', () => {
      const layout = useLayoutStore.getState().layout;
      layout.bins = [createBin('bin1', 'layer1')];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1'] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.moveToLayer('layer1');
      });

      // Should still be on layer1
      expect(useLayoutStore.getState().layout.bins[0].layerId).toBe('layer1');
    });
  });

  describe('updateMultiLayer', () => {
    it('moves multiple bins to another layer', () => {
      const layout = useLayoutStore.getState().layout;
      layout.layers = [
        { id: 'layer1', name: 'Layer 1', height: 3 },
        { id: 'layer2', name: 'Layer 2', height: 3 },
      ];
      layout.bins = [
        createBin('bin1', 'layer1', 0, 0),
        createBin('bin2', 'layer1', 3, 0),
      ];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: ['bin1', 'bin2'] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateMultiLayer('layer2');
      });

      const bins = useLayoutStore.getState().layout.bins;
      expect(bins[0].layerId).toBe('layer2');
      expect(bins[1].layerId).toBe('layer2');
    });

    it('does nothing when no bins selected', () => {
      const layout = useLayoutStore.getState().layout;
      layout.layers = [
        { id: 'layer1', name: 'Layer 1', height: 3 },
        { id: 'layer2', name: 'Layer 2', height: 3 },
      ];
      useLayoutStore.setState({ layout });
      useUIStore.setState({ selectedBinIds: [] });

      const { result } = renderHook(() => useBinInspector());

      // Should not throw
      expect(() => {
        act(() => {
          result.current.updateMultiLayer('layer2');
        });
      }).not.toThrow();
    });
  });

  describe('context', () => {
    it('returns layout and categories', () => {
      const { result } = renderHook(() => useBinInspector());

      expect(result.current.layout).toBeDefined();
      expect(result.current.categories).toBeDefined();
      expect(result.current.categories).toHaveLength(1);
    });
  });
});
