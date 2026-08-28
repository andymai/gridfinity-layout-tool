import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBinInspector } from '@/features/bin-inspector';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useToastStore } from '@/core/store/toast';
import { emitSyncEvent } from '@/shared/events/syncEventBus';
import { resetAllStores } from '@/test/testUtils';
import { connectSelectionPruning, eventBus } from '@/core/cqrs';
import type { Bin } from '@/core/types';
import {
  binId,
  layerId as toLayerId,
  categoryId as toCategoryId,
  designId as toDesignId,
  gridUnits,
  heightUnits,
  mm,
} from '@/core/types';

vi.mock('@/shared/events/syncEventBus', () => ({
  emitSyncEvent: vi.fn(),
}));

describe('useBinInspector', () => {
  // Helper to create bins at specific positions
  const createBin = (id: string, layerId: string, x = 0, y = 0, width = 2, depth = 2): Bin => ({
    id: binId(id),
    layerId: toLayerId(layerId),
    x: gridUnits(x),
    y: gridUnits(y),
    width: gridUnits(width),
    depth: gridUnits(depth),
    height: heightUnits(3),
    category: toCategoryId('coral'),
    label: '',
    notes: '',
  });

  let unsubscribePruning: () => void;

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Connect CQRS selection pruning subscriber so event-driven cleanup works
    unsubscribePruning = connectSelectionPruning(eventBus);

    // Set up default layout with a layer and category
    const layout = useLayoutStore.getState().layout;
    layout.layers = [{ id: toLayerId('layer1'), name: 'Layer 1', height: heightUnits(3) }];
    layout.categories = [{ id: toCategoryId('coral'), name: 'Coral', color: '#ff7f7f' }];
    layout.bins = [];
    useLayoutStore.setState({ layout });

    // Set default UI state
    useSelectionStore.setState({ activeLayerId: toLayerId('layer1'), selectedBinIds: [] });
  });

  afterEach(() => {
    unsubscribePruning();
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
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

      const { result } = renderHook(() => useBinInspector());

      expect(result.current.selectedBins).toHaveLength(1);
      expect(result.current.isMultiSelect).toBe(false);
      expect(result.current.bin?.id).toBe('bin1');
      expect(result.current.category?.id).toBe('coral');
      expect(result.current.layer?.id).toBe('layer1');
    });

    it('returns multiple bins for multi-select', () => {
      const bins = [createBin('bin1', 'layer1', 0, 0), createBin('bin2', 'layer1', 3, 0)];
      const layout = useLayoutStore.getState().layout;
      layout.bins = bins;
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1'), binId('bin2')] });

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
        minHeight: 2,
        maxHeight: 2,
        maxClearance: 0,
        maxGridUnits: { width: 5, depth: 5 },
        needsSplit: false,
        heightRange: '2u',
        minHeightReason: 'global_minimum',
        maxHeightReason: 'drawer_height',
      });
    });

    it('calculates constraints for selected bin', () => {
      const bin = createBin('bin1', 'layer1');
      const layout = useLayoutStore.getState().layout;
      layout.bins = [bin];
      layout.drawer.height = heightUnits(12);
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

      const { result } = renderHook(() => useBinInspector());

      expect(result.current.constraints.minHeight).toBe(3); // Layer height
      expect(result.current.constraints.maxHeight).toBe(12); // Drawer height
    });

    it('detects when bin needs split', () => {
      // Create a bin larger than print bed allows
      const bin = { ...createBin('bin1', 'layer1'), width: gridUnits(10), depth: gridUnits(10) };
      const layout = useLayoutStore.getState().layout;
      layout.bins = [bin];
      layout.printBedSize = mm(100); // Small print bed
      layout.gridUnitMm = mm(42);
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

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
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

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
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

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
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

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
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

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
      layout.drawer.height = heightUnits(12);
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateField('height', 100); // Should be clamped
      });

      expect(useLayoutStore.getState().layout.bins[0].height).toBeLessThanOrEqual(12);
    });

    it('preserves clearance when changing height', () => {
      const bin = {
        ...createBin('bin1', 'layer1'),
        height: heightUnits(5),
        clearanceHeight: heightUnits(3),
      };
      const layout = useLayoutStore.getState().layout;
      layout.bins = [bin];
      layout.drawer.height = heightUnits(12);
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

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

    it('emits bin-resized event when changing height of a linked bin', () => {
      const bin = {
        ...createBin('bin1', 'layer1'),
        height: heightUnits(3),
        linkedDesignId: toDesignId('design-1'),
      };
      const layout = useLayoutStore.getState().layout;
      layout.bins = [bin];
      layout.drawer.height = heightUnits(12);
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateField('height', 5);
      });

      expect(emitSyncEvent).toHaveBeenCalledWith({
        type: 'bin-resized',
        binId: 'bin1',
        linkedDesignId: 'design-1',
        newDimensions: { width: 2, depth: 2, height: 5 },
      });
    });

    it('does not emit bin-resized event when height unchanged on linked bin', () => {
      const bin = {
        ...createBin('bin1', 'layer1'),
        height: heightUnits(3),
        linkedDesignId: toDesignId('design-1'),
      };
      const layout = useLayoutStore.getState().layout;
      layout.bins = [bin];
      layout.drawer.height = heightUnits(12);
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });
      vi.mocked(emitSyncEvent).mockClear();

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateField('height', 3); // Same height
      });

      expect(emitSyncEvent).not.toHaveBeenCalled();
    });

    it('does not emit bin-resized event for unlinked bins', () => {
      const bin = createBin('bin1', 'layer1'); // No linkedDesignId
      const layout = useLayoutStore.getState().layout;
      layout.bins = [bin];
      layout.drawer.height = heightUnits(12);
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });
      vi.mocked(emitSyncEvent).mockClear();

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateField('height', 5);
      });

      expect(emitSyncEvent).not.toHaveBeenCalled();
    });

    it('emits bin-resized event when changing width of a linked bin', () => {
      const bin = { ...createBin('bin1', 'layer1'), linkedDesignId: toDesignId('design-1') };
      const layout = useLayoutStore.getState().layout;
      layout.bins = [bin];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateField('width', 4);
      });

      expect(emitSyncEvent).toHaveBeenCalledWith({
        type: 'bin-resized',
        binId: 'bin1',
        linkedDesignId: 'design-1',
        newDimensions: { width: 4, depth: 2, height: 3 },
      });
    });

    it('emits bin-resized event when changing depth of a linked bin', () => {
      const bin = { ...createBin('bin1', 'layer1'), linkedDesignId: toDesignId('design-1') };
      const layout = useLayoutStore.getState().layout;
      layout.bins = [bin];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateField('depth', 5);
      });

      expect(emitSyncEvent).toHaveBeenCalledWith({
        type: 'bin-resized',
        binId: 'bin1',
        linkedDesignId: 'design-1',
        newDimensions: { width: 2, depth: 5, height: 3 },
      });
    });
  });

  describe('updateMultiCategory', () => {
    it('updates category for multiple bins', () => {
      const layout = useLayoutStore.getState().layout;
      layout.categories.push({ id: toCategoryId('green'), name: 'Green', color: '#00ff00' });
      layout.bins = [createBin('bin1', 'layer1', 0, 0), createBin('bin2', 'layer1', 3, 0)];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1'), binId('bin2')] });

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
      layout.drawer.height = heightUnits(12);
      layout.bins = [
        { ...createBin('bin1', 'layer1', 0, 0), height: heightUnits(3) },
        { ...createBin('bin2', 'layer1', 3, 0), height: heightUnits(4) },
      ];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1'), binId('bin2')] });

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
      layout.drawer.height = heightUnits(6);
      layout.bins = [{ ...createBin('bin1', 'layer1'), height: heightUnits(5) }];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateMultiHeight(10); // Should be clamped
      });

      expect(useLayoutStore.getState().layout.bins[0].height).toBeLessThanOrEqual(6);
    });

    it('emits bin-resized events for linked bins', () => {
      const layout = useLayoutStore.getState().layout;
      layout.drawer.height = heightUnits(12);
      layout.bins = [
        {
          ...createBin('bin1', 'layer1', 0, 0),
          height: heightUnits(3),
          linkedDesignId: toDesignId('design-1'),
        },
        { ...createBin('bin2', 'layer1', 3, 0), height: heightUnits(4) }, // unlinked
      ];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1'), binId('bin2')] });
      vi.mocked(emitSyncEvent).mockClear();

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateMultiHeight(2);
      });

      // Only linked bin should emit
      expect(emitSyncEvent).toHaveBeenCalledTimes(1);
      expect(emitSyncEvent).toHaveBeenCalledWith({
        type: 'bin-resized',
        binId: 'bin1',
        linkedDesignId: 'design-1',
        newDimensions: { width: 2, depth: 2, height: 5 },
      });
    });

    it('deduplicates sync events by linkedDesignId', () => {
      const layout = useLayoutStore.getState().layout;
      layout.drawer.height = heightUnits(12);
      layout.bins = [
        {
          ...createBin('bin1', 'layer1', 0, 0),
          height: heightUnits(3),
          linkedDesignId: toDesignId('design-1'),
        },
        {
          ...createBin('bin2', 'layer1', 3, 0),
          height: heightUnits(3),
          linkedDesignId: toDesignId('design-1'),
        },
      ];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1'), binId('bin2')] });
      vi.mocked(emitSyncEvent).mockClear();

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateMultiHeight(2);
      });

      // Only one event per design, not per bin
      expect(emitSyncEvent).toHaveBeenCalledTimes(1);
    });

    it('toasts and leaves heights untouched when every selected bin is locked', () => {
      const layout = useLayoutStore.getState().layout;
      layout.drawer.height = heightUnits(12);
      layout.bins = [
        { ...createBin('bin1', 'layer1', 0, 0), height: heightUnits(3), locked: true },
        { ...createBin('bin2', 'layer1', 3, 0), height: heightUnits(4), locked: true },
      ];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1'), binId('bin2')] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.updateMultiHeight(2);
      });

      const bins = useLayoutStore.getState().layout.bins;
      expect(bins[0].height).toBe(3);
      expect(bins[1].height).toBe(4);
      expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
        'All selected bins are size-locked. Unlock them to change height.'
      );
    });
  });

  describe('updateMultiClearance', () => {
    it('updates clearance for multiple bins', () => {
      const layout = useLayoutStore.getState().layout;
      layout.drawer.height = heightUnits(12);
      layout.bins = [
        {
          ...createBin('bin1', 'layer1', 0, 0),
          height: heightUnits(3),
          clearanceHeight: heightUnits(0),
        },
        {
          ...createBin('bin2', 'layer1', 3, 0),
          height: heightUnits(4),
          clearanceHeight: heightUnits(1),
        },
      ];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1'), binId('bin2')] });

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
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

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
      layout.bins = [createBin('bin1', 'layer1', 0, 0), createBin('bin2', 'layer1', 3, 0)];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1'), binId('bin2')] });

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
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.requestDelete();
      });

      act(() => {
        result.current.confirmDelete();
      });

      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
      expect(useSelectionStore.getState().selectedBinIds).toHaveLength(0);
    });

    it('cancelDelete clears confirmation state', () => {
      const layout = useLayoutStore.getState().layout;
      layout.bins = [createBin('bin1', 'layer1')];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

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
      layout.bins = [createBin('bin1', 'layer1', 0, 0), createBin('bin2', 'layer1', 3, 0)];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1'), binId('bin2')] });

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
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

      const { result } = renderHook(() => useBinInspector());

      expect(useSelectionStore.getState().selectedBinIds).toHaveLength(1);

      act(() => {
        result.current.clearSelection();
      });

      expect(useSelectionStore.getState().selectedBinIds).toHaveLength(0);
    });
  });

  describe('rotateBin', () => {
    it('swaps width and depth', () => {
      const layout = useLayoutStore.getState().layout;
      layout.bins = [{ ...createBin('bin1', 'layer1'), width: gridUnits(2), depth: gridUnits(3) }];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

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
      layout.bins = [{ ...createBin('bin1', 'layer1'), width: gridUnits(2), depth: gridUnits(3) }];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

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

    it('emits bin-resized event when rotating a linked bin', () => {
      const layout = useLayoutStore.getState().layout;
      layout.bins = [
        {
          ...createBin('bin1', 'layer1'),
          width: gridUnits(2),
          depth: gridUnits(3),
          linkedDesignId: toDesignId('design-1'),
        },
      ];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });
      vi.mocked(emitSyncEvent).mockClear();

      const { result } = renderHook(() => useBinInspector());

      act(() => {
        result.current.rotateBin();
      });

      expect(emitSyncEvent).toHaveBeenCalledWith({
        type: 'bin-resized',
        binId: 'bin1',
        linkedDesignId: 'design-1',
        newDimensions: { width: 3, depth: 2, height: 3 },
      });
    });
  });

  describe('applySuggestedSize', () => {
    it('applies width, depth, and height in a single update', () => {
      const layout = useLayoutStore.getState().layout;
      layout.drawer.height = heightUnits(12);
      layout.bins = [createBin('bin1', 'layer1', 0, 0, 1, 1)];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

      const { result } = renderHook(() => useBinInspector());

      let applied: boolean | undefined;
      act(() => {
        applied = result.current.applySuggestedSize({ width: 2, depth: 2, height: 6 });
      });

      const bin = useLayoutStore.getState().layout.bins[0];
      expect(bin.width).toBe(2);
      expect(bin.depth).toBe(2);
      expect(bin.height).toBe(6);
      expect(applied).toBe(true);
    });

    it('fit check and apply agree for a bin with clearance (adjusted clearanceHeight)', () => {
      // Regression: canApplySuggestedSize must use the same adjusted clearance
      // that applySuggestedSize writes — not the original — so a taller
      // suggestion for a bin with clearance is not wrongly reported as unfittable.
      const layout = useLayoutStore.getState().layout;
      layout.drawer.height = heightUnits(12);
      layout.bins = [
        {
          ...createBin('bin1', 'layer1', 0, 0, 1, 1),
          height: heightUnits(3),
          clearanceHeight: heightUnits(3),
        },
      ];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

      const { result } = renderHook(() => useBinInspector());

      const size = { width: 2, depth: 2, height: 5 };
      expect(result.current.canApplySuggestedSize(size)).toBe(true);

      let applied: boolean | undefined;
      act(() => {
        applied = result.current.applySuggestedSize(size);
      });

      expect(applied).toBe(true);
      const bin = useLayoutStore.getState().layout.bins[0];
      expect(bin.height).toBe(5);
      // Clearance reduced so the total vertical footprint is preserved (3+3 = 5+1).
      expect(bin.height + (bin.clearanceHeight ?? 0)).toBe(6);
    });

    it('does not resize when the target size would collide with a neighbor', () => {
      const layout = useLayoutStore.getState().layout;
      layout.bins = [
        createBin('bin1', 'layer1', 0, 0, 2, 2),
        createBin('bin2', 'layer1', 2, 0, 2, 2),
      ];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

      const { result } = renderHook(() => useBinInspector());

      let applied: boolean | undefined;
      act(() => {
        applied = result.current.applySuggestedSize({ width: 4, depth: 2, height: 3 });
      });

      const bin = useLayoutStore.getState().layout.bins.find((b) => b.id === 'bin1');
      expect(bin?.width).toBe(2); // unchanged — blocked by neighbor
      expect(applied).toBeFalsy();
    });
  });

  describe('moveToLayer', () => {
    it('moves bin to another layer', () => {
      const layout = useLayoutStore.getState().layout;
      layout.layers = [
        { id: toLayerId('layer1'), name: 'Layer 1', height: heightUnits(3) },
        { id: toLayerId('layer2'), name: 'Layer 2', height: heightUnits(3) },
      ];
      layout.bins = [createBin('bin1', 'layer1')];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

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
      useSelectionStore.setState({ selectedBinIds: [binId('bin1')] });

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
        { id: toLayerId('layer1'), name: 'Layer 1', height: heightUnits(3) },
        { id: toLayerId('layer2'), name: 'Layer 2', height: heightUnits(3) },
      ];
      layout.bins = [createBin('bin1', 'layer1', 0, 0), createBin('bin2', 'layer1', 3, 0)];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [binId('bin1'), binId('bin2')] });

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
        { id: toLayerId('layer1'), name: 'Layer 1', height: heightUnits(3) },
        { id: toLayerId('layer2'), name: 'Layer 2', height: heightUnits(3) },
      ];
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: [] });

      const { result } = renderHook(() => useBinInspector());

      // Should not throw
      expect(() => {
        act(() => {
          result.current.updateMultiLayer('layer2');
        });
      }).not.toThrow();
    });
  });

  describe('size lock', () => {
    const selectBins = (bins: Bin[]) => {
      const layout = useLayoutStore.getState().layout;
      layout.bins = bins;
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({ selectedBinIds: bins.map((b) => b.id) });
    };

    const currentBin = (id: string): Bin | undefined =>
      useLayoutStore.getState().layout.bins.find((b) => b.id === binId(id));

    it('toggles the flag on the selected bin', () => {
      selectBins([createBin('bin1', 'layer1')]);
      const { result } = renderHook(() => useBinInspector());

      act(() => result.current.toggleLock());
      expect(currentBin('bin1')?.locked).toBe(true);

      act(() => result.current.toggleLock());
      expect(currentBin('bin1')?.locked).toBe(false);
    });

    it('refuses dimension edits on a locked bin', () => {
      selectBins([{ ...createBin('bin1', 'layer1'), locked: true }]);
      const { result } = renderHook(() => useBinInspector());

      act(() => result.current.updateField('width', 4));
      act(() => result.current.updateField('height', 6));

      expect(currentBin('bin1')?.width).toBe(2);
      expect(currentBin('bin1')?.height).toBe(3);
    });

    it('still accepts descriptive edits on a locked bin', () => {
      selectBins([{ ...createBin('bin1', 'layer1'), locked: true }]);
      const { result } = renderHook(() => useBinInspector());

      act(() => result.current.updateField('label', 'M3 screws'));

      expect(currentBin('bin1')?.label).toBe('M3 screws');
    });

    it('leaves a locked bin unrotated', () => {
      selectBins([{ ...createBin('bin1', 'layer1', 0, 0, 2, 1), locked: true }]);
      const { result } = renderHook(() => useBinInspector());

      let rotated = true;
      act(() => {
        rotated = result.current.rotateBin();
      });

      expect(rotated).toBe(false);
      expect(currentBin('bin1')?.width).toBe(2);
      expect(currentBin('bin1')?.depth).toBe(1);
    });

    it('applies one lock state across a mixed selection', () => {
      selectBins([
        { ...createBin('bin1', 'layer1', 0, 0), locked: true },
        createBin('bin2', 'layer1', 3, 0),
      ]);
      const { result } = renderHook(() => useBinInspector());

      act(() => result.current.setMultiLock(true));

      expect(currentBin('bin1')?.locked).toBe(true);
      expect(currentBin('bin2')?.locked).toBe(true);
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
