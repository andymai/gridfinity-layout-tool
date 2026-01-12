import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBinList } from '../../hooks/useBinList';
import { useLayoutStore } from '../../store/layout';
import { useToastStore } from '../../store/toast';
import { createDefaultLayout, generateId } from '../../constants';
import { resetAllStores } from '../testUtils';
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
      { id: 'cat3', name: 'Hardware', color: '#0000ff' },
    ],
    bins,
  };
}

describe('useBinList', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('search functionality', () => {
    it('returns all rows when search query is empty', () => {
      const layout = createTestLayout([
        createTestBin({ label: 'Screwdrivers' }),
        createTestBin({ label: 'Wrenches', x: 1 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      expect(result.current.searchQuery).toBe('');
      expect(result.current.rows.length).toBeGreaterThan(0);
    });

    it('filters rows by search query in labels', () => {
      const layout = createTestLayout([
        createTestBin({ label: 'Screwdrivers' }),
        createTestBin({ label: 'Wrenches', x: 1 }),
        createTestBin({ label: 'Socket set', x: 2 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      act(() => {
        result.current.setSearchQuery('screw');
      });

      expect(result.current.rows.length).toBe(1);
      expect(result.current.rows[0].labels).toContain('Screwdrivers');
    });

    it('filters rows by search query in notes', () => {
      const layout = createTestLayout([
        createTestBin({ label: 'Bin 1', notes: 'Keep spare parts here' }),
        createTestBin({ label: 'Bin 2', notes: 'For electronics', x: 1 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      act(() => {
        result.current.setSearchQuery('spare');
      });

      expect(result.current.rows.length).toBe(1);
      expect(result.current.rows[0].notes).toContain('spare');
    });

    it('search is case-insensitive', () => {
      const layout = createTestLayout([
        createTestBin({ label: 'TOOLS' }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      act(() => {
        result.current.setSearchQuery('tools');
      });

      expect(result.current.rows.length).toBe(1);
    });

    it('preserves unfiltered rows', () => {
      const layout = createTestLayout([
        createTestBin({ label: 'Screwdrivers' }),
        createTestBin({ label: 'Wrenches', x: 1 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());
      const unfilteredCount = result.current.unfilteredRows.length;

      act(() => {
        result.current.setSearchQuery('screw');
      });

      expect(result.current.rows.length).toBeLessThan(unfilteredCount);
      expect(result.current.unfilteredRows.length).toBe(unfilteredCount);
    });
  });

  describe('selection functionality', () => {
    it('starts with empty selection', () => {
      const layout = createTestLayout([createTestBin()]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      expect(result.current.selectedIndices.size).toBe(0);
      expect(result.current.selectionCount).toBe(0);
      expect(result.current.isAllSelected).toBe(false);
    });

    it('toggles row selection', () => {
      const layout = createTestLayout([
        createTestBin({ id: 'bin1' }),
        createTestBin({ id: 'bin2', x: 1 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      act(() => {
        result.current.toggleRowSelection(0);
      });

      expect(result.current.selectedIndices.has(0)).toBe(true);
      expect(result.current.selectionCount).toBe(1);

      // Toggle off
      act(() => {
        result.current.toggleRowSelection(0);
      });

      expect(result.current.selectedIndices.has(0)).toBe(false);
      expect(result.current.selectionCount).toBe(0);
    });

    it('supports shift-click range selection', () => {
      const layout = createTestLayout([
        createTestBin({ id: 'bin1' }),
        createTestBin({ id: 'bin2', x: 1 }),
        createTestBin({ id: 'bin3', x: 2 }),
        createTestBin({ id: 'bin4', x: 3 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      // Select first row
      act(() => {
        result.current.toggleRowSelection(0);
      });

      // Shift-click third row
      act(() => {
        result.current.toggleRowSelection(2, true);
      });

      expect(result.current.selectionCount).toBe(3); // 0, 1, 2
      expect(result.current.selectedIndices.has(0)).toBe(true);
      expect(result.current.selectedIndices.has(1)).toBe(true);
      expect(result.current.selectedIndices.has(2)).toBe(true);
    });

    it('selects all rows', () => {
      const layout = createTestLayout([
        createTestBin({ id: 'bin1' }),
        createTestBin({ id: 'bin2', x: 1 }),
        createTestBin({ id: 'bin3', x: 2 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      act(() => {
        result.current.selectAllRows();
      });

      expect(result.current.isAllSelected).toBe(true);
      expect(result.current.selectionCount).toBe(result.current.rows.length);
    });

    it('clears selection', () => {
      const layout = createTestLayout([
        createTestBin({ id: 'bin1' }),
        createTestBin({ id: 'bin2', x: 1 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      act(() => {
        result.current.toggleRowSelection(0);
        result.current.toggleRowSelection(1);
      });

      expect(result.current.selectionCount).toBe(2);

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectionCount).toBe(0);
      expect(result.current.lastSelectedIndex).toBeNull();
    });

    it('returns selected bin IDs', () => {
      const layout = createTestLayout([
        createTestBin({ id: 'bin1' }),
        createTestBin({ id: 'bin2', x: 1 }),
        createTestBin({ id: 'bin3', x: 2 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      act(() => {
        result.current.toggleRowSelection(0);
      });

      expect(result.current.selectedBinIds.length).toBeGreaterThan(0);
    });
  });

  describe('bulk actions', () => {
    it('deletes selected bins', () => {
      const layout = createTestLayout([
        createTestBin({ id: 'bin1' }),
        createTestBin({ id: 'bin2', x: 1 }),
        createTestBin({ id: 'bin3', x: 2 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());
      const initialBinCount = useLayoutStore.getState().layout.bins.length;

      // Select first row
      act(() => {
        result.current.toggleRowSelection(0);
      });

      // Delete
      act(() => {
        result.current.deleteBulkSelection();
      });

      expect(useLayoutStore.getState().layout.bins.length).toBeLessThan(initialBinCount);
      expect(result.current.selectionCount).toBe(0); // Selection cleared
    });

    it('shows toast after bulk delete', () => {
      const layout = createTestLayout([
        createTestBin({ id: 'bin1' }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      act(() => {
        result.current.toggleRowSelection(0);
      });

      act(() => {
        result.current.deleteBulkSelection();
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts.length).toBeGreaterThan(0);
      expect(toasts[0].type).toBe('success');
    });

    it('changes category for selected bins', () => {
      const layout = createTestLayout([
        createTestBin({ id: 'bin1', category: 'cat1' }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      act(() => {
        result.current.toggleRowSelection(0);
      });

      act(() => {
        result.current.changeBulkCategory('cat2');
      });

      const bin = useLayoutStore.getState().layout.bins.find(b => b.id === 'bin1');
      expect(bin?.category).toBe('cat2');
      expect(result.current.selectionCount).toBe(0); // Selection cleared
    });

    it('updates label for selected bins', () => {
      const layout = createTestLayout([
        createTestBin({ id: 'bin1', label: 'Old label' }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      act(() => {
        result.current.toggleRowSelection(0);
      });

      act(() => {
        result.current.updateBulkLabel('New label');
      });

      const bin = useLayoutStore.getState().layout.bins.find(b => b.id === 'bin1');
      expect(bin?.label).toBe('New label');
    });

    it('updates notes for selected bins', () => {
      const layout = createTestLayout([
        createTestBin({ id: 'bin1', notes: 'Old notes' }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      act(() => {
        result.current.toggleRowSelection(0);
      });

      act(() => {
        result.current.updateBulkNotes('New notes');
      });

      const bin = useLayoutStore.getState().layout.bins.find(b => b.id === 'bin1');
      expect(bin?.notes).toBe('New notes');
    });

    it('does nothing when no selection for bulk actions', () => {
      const layout = createTestLayout([
        createTestBin({ id: 'bin1' }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());
      const initialBinCount = useLayoutStore.getState().layout.bins.length;

      // No selection
      expect(result.current.selectionCount).toBe(0);

      act(() => {
        result.current.deleteBulkSelection();
      });

      // Bins unchanged
      expect(useLayoutStore.getState().layout.bins.length).toBe(initialBinCount);
    });
  });

  describe('export functionality', () => {
    it('exports to TSV format', () => {
      const layout = createTestLayout([
        createTestBin({ label: 'Test Bin', width: 2, depth: 2, height: 3 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());
      const tsv = result.current.exportToTSV();

      expect(tsv).toContain('Size\tHeight\tBins');
      expect(tsv).toContain('2×2');
    });

    it('exports to CSV format', () => {
      const layout = createTestLayout([
        createTestBin({ label: 'Test Bin', width: 2, depth: 2, height: 3 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());
      const csv = result.current.exportToCSV();

      expect(csv).toContain('Size,Height,Bins');
      expect(csv).toContain('2×2');
    });

    it('exports to JSON format', () => {
      const layout = createTestLayout([
        createTestBin({ label: 'Test Bin', width: 2, depth: 2, height: 3 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());
      const json = result.current.exportToJSON();
      const parsed = JSON.parse(json);

      expect(parsed._meta).toBeDefined();
      expect(parsed.bins).toBeDefined();
      expect(parsed.bins.length).toBeGreaterThan(0);
    });

    it('copies to clipboard', async () => {
      const layout = createTestLayout([
        createTestBin({ label: 'Test Bin' }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.copyToClipboard('tsv');
      });

      expect(success).toBe(true);
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  describe('category breakdown', () => {
    it('calculates category breakdown', () => {
      const layout = createTestLayout([
        createTestBin({ category: 'cat1', width: 2, depth: 2 }),
        createTestBin({ category: 'cat1', width: 1, depth: 1, x: 2 }),
        createTestBin({ category: 'cat2', width: 3, depth: 3, x: 3 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      expect(result.current.categoryBreakdown.length).toBeGreaterThan(0);

      const cat1 = result.current.categoryBreakdown.find(b => b.categoryId === 'cat1');
      const cat2 = result.current.categoryBreakdown.find(b => b.categoryId === 'cat2');

      expect(cat1).toBeDefined();
      expect(cat2).toBeDefined();
      expect(cat1!.categoryName).toBe('Tools');
      expect(cat2!.categoryName).toBe('Parts');
    });

    it('includes percentages in breakdown', () => {
      const layout = createTestLayout([
        createTestBin({ category: 'cat1', width: 2, depth: 2 }),
        createTestBin({ category: 'cat2', width: 2, depth: 2, x: 2 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      const totalPercentage = result.current.categoryBreakdown.reduce(
        (sum, b) => sum + b.percentage,
        0
      );

      // Should sum to approximately 100%
      expect(totalPercentage).toBeCloseTo(100, 0);
    });
  });

  describe('inherits from usePrintList', () => {
    it('has sort functionality', () => {
      const layout = createTestLayout([
        createTestBin({ width: 1, depth: 1 }),
        createTestBin({ width: 3, depth: 3, x: 1 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      act(() => {
        result.current.setSort('area');
      });

      expect(result.current.filters.sortKey).toBe('area');
    });

    it('has filter functionality', () => {
      const layout = createTestLayout([
        createTestBin({ category: 'cat1' }),
        createTestBin({ category: 'cat2', x: 1 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      act(() => {
        result.current.toggleCategoryVisibility('cat1');
      });

      expect(result.current.filters.hiddenCategoryIds.has('cat1')).toBe(true);
    });

    it('has grouping functionality', () => {
      const layout = createTestLayout([
        createTestBin({ category: 'cat1' }),
        createTestBin({ category: 'cat2', x: 1 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      expect(result.current.groupedRows).toBeNull();

      act(() => {
        result.current.toggleGroupByCategory();
      });

      expect(result.current.groupedRows).not.toBeNull();
    });

    it('has aggregate calculations', () => {
      const layout = createTestLayout([
        createTestBin({ width: 2, depth: 2, height: 3 }),
      ]);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useBinList());

      expect(result.current.totalBins).toBe(1);
      expect(result.current.totalFilament).toBeGreaterThan(0);
      expect(result.current.totalCost).toBeGreaterThan(0);
    });
  });
});
