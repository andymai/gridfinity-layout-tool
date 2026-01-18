/**
 * Extended hook for the expanded bin list feature.
 * Builds on usePrintList with text search, bulk selection, and bulk actions.
 */

import { useMemo, useState, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useUIStore, useUndoableAction, useToastStore } from '../core/store';
import { usePrintList, type UsePrintListReturn } from '../features/print-export/hooks/usePrintList';
import {
  filterBySearch,
  calculateSelectionRange,
  toggleSelection,
  getSelectedBinIds,
  formatAsCSV,
  formatAsJSON,
  downloadAsFile,
  calculateCategoryBreakdown,
  type CategoryBreakdown,
} from '../utils/binListOperations';
import { exportPrintListTSV } from '../core/storage';
import type { EnhancedPrintRow } from '../core/types';

export interface UseBinListReturn extends Omit<UsePrintListReturn, 'rows'> {
  // Filtered rows (after text search)
  rows: EnhancedPrintRow[];
  /** Original rows before text search filter */
  unfilteredRows: EnhancedPrintRow[];

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Selection
  selectedIndices: Set<number>;
  lastSelectedIndex: number | null;
  selectedBinIds: string[];
  toggleRowSelection: (index: number, shiftKey?: boolean) => void;
  selectAllRows: () => void;
  clearSelection: () => void;
  isAllSelected: boolean;
  selectionCount: number;

  // Bulk actions (operate on selected bins)
  deleteBulkSelection: () => void;
  changeBulkCategory: (categoryId: string) => void;
  updateBulkLabel: (label: string) => void;
  updateBulkNotes: (notes: string) => void;

  // Inline editing (operate on specific bin IDs)
  updateBinLabel: (binIds: string[], label: string) => void;
  updateBinNotes: (binIds: string[], notes: string) => void;

  // Export
  exportToTSV: () => string;
  exportToCSV: () => string;
  exportToJSON: () => string;
  downloadExport: (format: 'tsv' | 'csv' | 'json', filename?: string) => void;
  copyToClipboard: (format: 'tsv' | 'csv' | 'json') => Promise<boolean>;

  // Category breakdown for visualization
  categoryBreakdown: CategoryBreakdown[];
}

export function useBinList(): UseBinListReturn {
  // Get base print list functionality
  const printList = usePrintList();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Selection state
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Store access for mutations
  const { updateBin, deleteBin } = useLayoutStore(
    useShallow((state) => ({
      updateBin: state.updateBin,
      deleteBin: state.deleteBin,
    }))
  );

  const layout = useLayoutStore((state) => state.layout);

  const { setSelectedBins, announceToScreenReader } = useUIStore(
    useShallow((state) => ({
      setSelectedBins: state.setSelectedBins,
      announceToScreenReader: state.announceToScreenReader,
    }))
  );

  const { execute } = useUndoableAction();
  const addToast = useToastStore((state) => state.addToast);

  // Apply text search filter to rows
  const filteredRows = useMemo(() => {
    return filterBySearch(printList.rows, searchQuery);
  }, [printList.rows, searchQuery]);

  // Get selected bin IDs
  const selectedBinIds = useMemo(() => {
    return getSelectedBinIds(filteredRows, selectedIndices);
  }, [filteredRows, selectedIndices]);

  // Category breakdown for visualization
  const categoryBreakdown = useMemo(() => {
    return calculateCategoryBreakdown(filteredRows, printList.categories);
  }, [filteredRows, printList.categories]);

  // Selection handlers
  const toggleRowSelection = useCallback((index: number, shiftKey = false) => {
    if (shiftKey && lastSelectedIndex !== null) {
      setSelectedIndices((current) =>
        calculateSelectionRange(current, index, lastSelectedIndex)
      );
    } else {
      setSelectedIndices((current) => toggleSelection(current, index));
    }
    setLastSelectedIndex(index);
  }, [lastSelectedIndex]);

  const selectAllRows = useCallback(() => {
    const allIndices = new Set(filteredRows.map((_, i) => i));
    setSelectedIndices(allIndices);
    setLastSelectedIndex(filteredRows.length > 0 ? filteredRows.length - 1 : null);
    announceToScreenReader(`Selected all ${filteredRows.length} rows`);
  }, [filteredRows, announceToScreenReader]);

  const clearSelection = useCallback(() => {
    setSelectedIndices(new Set());
    setLastSelectedIndex(null);
  }, []);

  // Note: We intentionally don't auto-clear selection on filter changes
  // because it would clear selection unexpectedly. User explicitly clears
  // or bulk actions clear after completing.

  // Bulk action handlers
  const deleteBulkSelection = useCallback(() => {
    if (selectedBinIds.length === 0) return;

    const count = selectedBinIds.length;
    execute(() => {
      for (const binId of selectedBinIds) {
        deleteBin(binId);
      }
    });

    clearSelection();
    setSelectedBins([]);
    addToast(`Deleted ${count} bin${count !== 1 ? 's' : ''}`, 'success');
    announceToScreenReader(`Deleted ${count} bins`);
  }, [selectedBinIds, execute, deleteBin, clearSelection, setSelectedBins, addToast, announceToScreenReader]);

  const changeBulkCategory = useCallback((categoryId: string) => {
    if (selectedBinIds.length === 0) return;

    const count = selectedBinIds.length;
    const category = printList.categories.find((c) => c.id === categoryId);

    execute(() => {
      for (const binId of selectedBinIds) {
        updateBin(binId, { category: categoryId });
      }
    });

    clearSelection();
    addToast(`Changed ${count} bin${count !== 1 ? 's' : ''} to ${category?.name || 'category'}`, 'success');
    announceToScreenReader(`Changed category for ${count} bins`);
  }, [selectedBinIds, printList.categories, execute, updateBin, clearSelection, addToast, announceToScreenReader]);

  const updateBulkLabel = useCallback((label: string) => {
    if (selectedBinIds.length === 0) return;

    const count = selectedBinIds.length;
    execute(() => {
      for (const binId of selectedBinIds) {
        updateBin(binId, { label });
      }
    });

    addToast(`Updated label for ${count} bin${count !== 1 ? 's' : ''}`, 'success');
  }, [selectedBinIds, execute, updateBin, addToast]);

  const updateBulkNotes = useCallback((notes: string) => {
    if (selectedBinIds.length === 0) return;

    const count = selectedBinIds.length;
    execute(() => {
      for (const binId of selectedBinIds) {
        updateBin(binId, { notes });
      }
    });

    addToast(`Updated notes for ${count} bin${count !== 1 ? 's' : ''}`, 'success');
  }, [selectedBinIds, execute, updateBin, addToast]);

  // Inline editing handlers (for specific bin IDs, not selection-based)
  const updateBinLabel = useCallback((binIds: string[], label: string) => {
    if (binIds.length === 0) return;

    const count = binIds.length;
    execute(() => {
      for (const binId of binIds) {
        updateBin(binId, { label });
      }
    });

    addToast(`Updated label for ${count} bin${count !== 1 ? 's' : ''}`, 'success');
  }, [execute, updateBin, addToast]);

  const updateBinNotes = useCallback((binIds: string[], notes: string) => {
    if (binIds.length === 0) return;

    const count = binIds.length;
    execute(() => {
      for (const binId of binIds) {
        updateBin(binId, { notes });
      }
    });

    addToast(`Updated notes for ${count} bin${count !== 1 ? 's' : ''}`, 'success');
  }, [execute, updateBin, addToast]);

  // Export handlers
  const exportToTSV = useCallback(() => {
    return exportPrintListTSV(filteredRows, {
      layoutName: layout.name,
      gridSize: `${layout.drawer.width}×${layout.drawer.depth}`,
    });
  }, [filteredRows, layout.name, layout.drawer.width, layout.drawer.depth]);

  const exportToCSV = useCallback(() => {
    return formatAsCSV(filteredRows, {
      layoutName: layout.name,
      gridSize: `${layout.drawer.width}×${layout.drawer.depth}`,
    });
  }, [filteredRows, layout.name, layout.drawer.width, layout.drawer.depth]);

  const exportToJSON = useCallback(() => {
    return formatAsJSON(filteredRows, layout);
  }, [filteredRows, layout]);

  const downloadExport = useCallback((format: 'tsv' | 'csv' | 'json', filename?: string) => {
    const baseName = filename || layout.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'bin-list';

    let content: string;
    let extension: string;
    let mimeType: string;

    switch (format) {
      case 'tsv':
        content = exportToTSV();
        extension = 'tsv';
        mimeType = 'text/tab-separated-values';
        break;
      case 'csv':
        content = exportToCSV();
        extension = 'csv';
        mimeType = 'text/csv';
        break;
      case 'json':
        content = exportToJSON();
        extension = 'json';
        mimeType = 'application/json';
        break;
    }

    downloadAsFile(content, `${baseName}.${extension}`, mimeType);
    addToast(`Downloaded ${extension.toUpperCase()} file`, 'success');
  }, [exportToTSV, exportToCSV, exportToJSON, layout.name, addToast]);

  const copyToClipboardFn = useCallback(async (format: 'tsv' | 'csv' | 'json'): Promise<boolean> => {
    let content: string;
    switch (format) {
      case 'tsv':
        content = exportToTSV();
        break;
      case 'csv':
        content = exportToCSV();
        break;
      case 'json':
        content = exportToJSON();
        break;
    }

    try {
      await navigator.clipboard.writeText(content);
      addToast(`Copied ${format.toUpperCase()} to clipboard`, 'success');
      return true;
    } catch {
      addToast('Failed to copy to clipboard', 'error');
      return false;
    }
  }, [exportToTSV, exportToCSV, exportToJSON, addToast]);

  // Computed values
  const isAllSelected = filteredRows.length > 0 && selectedIndices.size === filteredRows.length;
  const selectionCount = selectedIndices.size;

  return {
    // Pass through from usePrintList (with filtered rows)
    ...printList,
    rows: filteredRows,
    unfilteredRows: printList.rows,

    // Search
    searchQuery,
    setSearchQuery,

    // Selection
    selectedIndices,
    lastSelectedIndex,
    selectedBinIds,
    toggleRowSelection,
    selectAllRows,
    clearSelection,
    isAllSelected,
    selectionCount,

    // Bulk actions (operate on selected bins)
    deleteBulkSelection,
    changeBulkCategory,
    updateBulkLabel,
    updateBulkNotes,

    // Inline editing (operate on specific bin IDs)
    updateBinLabel,
    updateBinNotes,

    // Export
    exportToTSV,
    exportToCSV,
    exportToJSON,
    downloadExport,
    copyToClipboard: copyToClipboardFn,

    // Category breakdown
    categoryBreakdown,
  };
}
