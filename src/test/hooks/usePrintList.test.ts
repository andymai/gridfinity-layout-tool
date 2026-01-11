import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePrintList } from '../../hooks/usePrintList';
import { useLayoutStore } from '../../store/layout';
import { useUIStore } from '../../store/ui';
import { createDefaultLayout, generateId } from '../../constants';
import type { Layout, Bin } from '../../types';

// Helper to create test bins
function createTestBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: generateId(),
    x: 0,
    y: 0,
    width: 1,
    depth: 1,
    height: 3,
    layerId: 'layer1',
    category: 'cat1',
    label: '',
    notes: '',
    ...overrides,
  };
}

// Helper to create a test layout
function createTestLayout(bins: Bin[] = []): Layout {
  const layout = createDefaultLayout();
  return {
    ...layout,
    layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
    categories: [
      { id: 'cat1', name: 'Tools', color: '#ff0000' },
      { id: 'cat2', name: 'Parts', color: '#00ff00' },
    ],
    bins,
  };
}

describe('usePrintList', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset stores
    const layout = createTestLayout();
    useLayoutStore.setState({
      layout,
      activeLayoutId: 'test-layout',
    });
    useUIStore.setState({
      selectedBinIds: [],
    });
  });

  describe('basic data generation', () => {
    it('returns empty rows for layout with no bins', () => {
      const { result } = renderHook(() => usePrintList());

      expect(result.current.rows).toHaveLength(0);
      expect(result.current.totalBins).toBe(0);
      expect(result.current.totalFilament).toBe(0);
      expect(result.current.totalCost).toBe(0);
    });

    it('generates rows from bins', () => {
      const layout = createTestLayout([
        createTestBin({ width: 1, depth: 1, height: 3 }),
        createTestBin({ width: 2, depth: 2, height: 3, x: 2, y: 0 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => usePrintList());

      expect(result.current.rows.length).toBeGreaterThan(0);
      expect(result.current.totalBins).toBe(2);
    });

    it('calculates total filament', () => {
      const layout = createTestLayout([
        createTestBin({ width: 1, depth: 1, height: 3 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => usePrintList());

      expect(result.current.totalFilament).toBeGreaterThan(0);
    });

    it('calculates total cost based on filament', () => {
      const layout = createTestLayout([
        createTestBin({ width: 2, depth: 2, height: 3 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => usePrintList());

      expect(result.current.totalCost).toBeGreaterThan(0);
    });

    it('calculates spool percentage', () => {
      const layout = createTestLayout([
        createTestBin({ width: 2, depth: 2, height: 3 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => usePrintList());

      expect(result.current.spoolPercentage).toBeGreaterThan(0);
      expect(result.current.spoolPercentage).toBeLessThanOrEqual(100);
    });

    it('calculates print time', () => {
      const layout = createTestLayout([
        createTestBin({ width: 2, depth: 2, height: 3 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => usePrintList());

      expect(result.current.totalPrintTimeHours).toBeGreaterThan(0);
    });
  });

  describe('filtering', () => {
    it('toggles category visibility', () => {
      const layout = createTestLayout([
        createTestBin({ category: 'cat1' }),
        createTestBin({ category: 'cat2', x: 1 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => usePrintList());

      // Initially all categories visible
      const initialRowCount = result.current.rows.length;
      expect(result.current.filters.hiddenCategoryIds.size).toBe(0);

      // Hide cat1
      act(() => {
        result.current.toggleCategoryVisibility('cat1');
      });

      expect(result.current.filters.hiddenCategoryIds.has('cat1')).toBe(true);
      expect(result.current.rows.length).toBeLessThan(initialRowCount);

      // Toggle again to show
      act(() => {
        result.current.toggleCategoryVisibility('cat1');
      });

      expect(result.current.filters.hiddenCategoryIds.has('cat1')).toBe(false);
    });

    it('resets filters', () => {
      const { result } = renderHook(() => usePrintList());

      // Set some filters
      act(() => {
        result.current.toggleCategoryVisibility('cat1');
        result.current.setSort('area');
        result.current.toggleGroupByCategory();
      });

      expect(result.current.filters.hiddenCategoryIds.size).toBe(1);
      expect(result.current.filters.sortKey).toBe('area');
      expect(result.current.filters.groupByCategory).toBe(true);

      // Reset
      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters.hiddenCategoryIds.size).toBe(0);
      expect(result.current.filters.sortKey).toBe('default');
      expect(result.current.filters.groupByCategory).toBe(false);
    });
  });

  describe('sorting', () => {
    it('sets sort key', () => {
      const { result } = renderHook(() => usePrintList());

      act(() => {
        result.current.setSort('area');
      });

      expect(result.current.filters.sortKey).toBe('area');
    });

    it('toggles sort order when clicking same sort key', () => {
      const { result } = renderHook(() => usePrintList());

      act(() => {
        result.current.setSort('area');
      });

      expect(result.current.filters.sortOrder).toBe('desc');

      act(() => {
        result.current.setSort('area');
      });

      expect(result.current.filters.sortOrder).toBe('asc');
    });

    it('resets to desc when changing sort key', () => {
      const { result } = renderHook(() => usePrintList());

      // Set to area, toggle to asc
      act(() => {
        result.current.setSort('area');
        result.current.setSort('area');
      });

      expect(result.current.filters.sortOrder).toBe('asc');

      // Change to height
      act(() => {
        result.current.setSort('height');
      });

      expect(result.current.filters.sortOrder).toBe('desc');
    });

    it('toggles sort order independently', () => {
      const { result } = renderHook(() => usePrintList());

      expect(result.current.filters.sortOrder).toBe('desc');

      act(() => {
        result.current.toggleSortOrder();
      });

      expect(result.current.filters.sortOrder).toBe('asc');

      act(() => {
        result.current.toggleSortOrder();
      });

      expect(result.current.filters.sortOrder).toBe('desc');
    });
  });

  describe('grouping', () => {
    it('toggles group by category', () => {
      const layout = createTestLayout([
        createTestBin({ category: 'cat1' }),
        createTestBin({ category: 'cat2', x: 1 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => usePrintList());

      expect(result.current.groupedRows).toBeNull();

      act(() => {
        result.current.toggleGroupByCategory();
      });

      expect(result.current.groupedRows).not.toBeNull();
      expect(result.current.groupedRows!.length).toBeGreaterThan(0);
    });

    it('grouped rows contain category info', () => {
      const layout = createTestLayout([
        createTestBin({ category: 'cat1' }),
        createTestBin({ category: 'cat2', x: 1 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => usePrintList());

      act(() => {
        result.current.toggleGroupByCategory();
      });

      const groups = result.current.groupedRows!;
      expect(groups.some(g => g.categoryId === 'cat1')).toBe(true);
      expect(groups.some(g => g.categoryId === 'cat2')).toBe(true);
    });
  });

  describe('config', () => {
    it('allows setting filament cost per kg', () => {
      const { result } = renderHook(() => usePrintList());

      expect(result.current.config.filamentCostPerKg).toBe(15); // default

      act(() => {
        result.current.setFilamentCostPerKg(25);
      });

      expect(result.current.config.filamentCostPerKg).toBe(25);
    });

    it('prevents negative cost', () => {
      const { result } = renderHook(() => usePrintList());

      act(() => {
        result.current.setFilamentCostPerKg(-10);
      });

      expect(result.current.config.filamentCostPerKg).toBe(0);
    });

    it('updates total cost when config changes', () => {
      const layout = createTestLayout([
        createTestBin({ width: 2, depth: 2, height: 3 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => usePrintList());

      const initialCost = result.current.totalCost;

      act(() => {
        result.current.setFilamentCostPerKg(30); // Double the default
      });

      // Cost should roughly double
      expect(result.current.totalCost).toBeGreaterThan(initialCost);
    });
  });

  describe('selection', () => {
    it('selects bins by row', () => {
      const bin1 = createTestBin({ id: 'bin1', width: 1, depth: 1 });
      const bin2 = createTestBin({ id: 'bin2', width: 1, depth: 1, x: 1 });
      const layout = createTestLayout([bin1, bin2]);
      useLayoutStore.setState({ layout });

      const setSelectedBinsMock = vi.fn();
      useUIStore.setState({ setSelectedBins: setSelectedBinsMock });

      const { result } = renderHook(() => usePrintList());

      // Get a row and select it
      const row = result.current.rows[0];
      if (row) {
        act(() => {
          result.current.selectBinsByRow(row);
        });

        expect(setSelectedBinsMock).toHaveBeenCalledWith(row.binIds);
      }
    });
  });

  describe('split detection', () => {
    it('detects bins that need splitting', () => {
      // Create a large bin that exceeds print bed
      const layout = createTestLayout([
        createTestBin({ width: 10, depth: 10, height: 3 }), // Way larger than typical print bed
      ]);
      layout.printBedSize = 84; // Small print bed (2 grid units)
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => usePrintList());

      // Some rows should need splitting
      expect(result.current.hasAnySplits).toBe(true);
    });

    it('reports no splits for small bins', () => {
      const layout = createTestLayout([
        createTestBin({ width: 1, depth: 1, height: 3 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => usePrintList());

      expect(result.current.hasAnySplits).toBe(false);
    });
  });

  describe('categories', () => {
    it('returns categories from layout', () => {
      const { result } = renderHook(() => usePrintList());

      expect(result.current.categories).toHaveLength(2);
      expect(result.current.categories[0].name).toBe('Tools');
      expect(result.current.categories[1].name).toBe('Parts');
    });
  });

  describe('aggregates', () => {
    it('calculates total bins correctly', () => {
      const layout = createTestLayout([
        createTestBin({ x: 0, y: 0 }),
        createTestBin({ x: 1, y: 0 }),
        createTestBin({ x: 2, y: 0 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => usePrintList());

      expect(result.current.totalBins).toBe(3);
    });

    it('calculates total pieces correctly', () => {
      // Bins of different sizes will generate different piece counts when split
      const layout = createTestLayout([
        createTestBin({ width: 1, depth: 1, height: 3 }), // 1 piece
        createTestBin({ width: 1, depth: 1, height: 3, x: 1 }), // 1 piece
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => usePrintList());

      // Each 1x1 bin is 1 piece
      expect(result.current.totalPieces).toBeGreaterThanOrEqual(2);
    });

    it('calculates spool estimate correctly', () => {
      const layout = createTestLayout([
        createTestBin({ width: 2, depth: 2, height: 6 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => usePrintList());

      // Should estimate partial spools
      expect(result.current.spoolEstimate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reactivity', () => {
    it('updates when bins are added', () => {
      const layout = createTestLayout([]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => usePrintList());

      expect(result.current.totalBins).toBe(0);

      // Add a bin
      act(() => {
        const { addBin, layout: currentLayout } = useLayoutStore.getState();
        addBin({
          layerId: currentLayout.layers[0].id,
          x: 0,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          category: currentLayout.categories[0].id,
          label: '',
          notes: '',
        });
      });

      expect(result.current.totalBins).toBe(1);
    });

    it('updates when bins are removed', () => {
      const bin1 = createTestBin({ id: 'bin1' });
      const layout = createTestLayout([bin1]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => usePrintList());

      expect(result.current.totalBins).toBe(1);

      // Remove the bin
      act(() => {
        useLayoutStore.getState().deleteBin('bin1');
      });

      expect(result.current.totalBins).toBe(0);
    });
  });
});
