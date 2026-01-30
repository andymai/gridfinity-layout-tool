/**
 * Extended hook for the expanded bin list feature.
 * Builds on usePrintList with text search, bulk selection, and bulk actions.
 */

import { useMemo, useState, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useUndoableAction } from '@/core/store/history';
import { useToastStore } from '@/core/store/toast';
import { useSelectionStore } from '@/core/store/selection';
import { useInteractionStore } from '@/core/store/interaction';
import type { LayoutError } from '@/core/result';
import { markFeatureUsed } from '@/shared/analytics/posthog';
import { isErr, getUserMessage } from '@/core/result';
import { findBinsByIds } from '@/utils/entity';
import { usePrintList, type UsePrintListReturn } from '@/features/print-export';
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
} from '@/shared/utils/binListOperations';
import { exportPrintListTSV } from '@/core/storage';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import type { EnhancedPrintRow } from '@/core/types';
import { useTranslation } from '@/i18n';

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
  const t = useTranslation();
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

  const setSelectedBins = useSelectionStore((state) => state.setSelectedBins);
  const announceToScreenReader = useInteractionStore((state) => state.announceToScreenReader);

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
  const toggleRowSelection = useCallback(
    (index: number, shiftKey = false) => {
      if (shiftKey && lastSelectedIndex !== null) {
        setSelectedIndices((current) => calculateSelectionRange(current, index, lastSelectedIndex));
      } else {
        setSelectedIndices((current) => toggleSelection(current, index));
      }
      setLastSelectedIndex(index);
    },
    [lastSelectedIndex]
  );

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

    // Track deletion BEFORE executing (need bin data)
    const binsToDelete = findBinsByIds(layout, selectedBinIds);
    if (binsToDelete.length > 0) {
      mlTracking.trackDeletion(binsToDelete[0], 'bulk', binsToDelete.length);

      // Track quick corrections for each deleted bin
      for (const bin of binsToDelete) {
        mlTracking.trackQuickCorrect('delete', bin.id, bin);
      }
    }

    let successCount = 0;
    let lastError: LayoutError | null = null;

    execute(() => {
      for (const binId of selectedBinIds) {
        const result = deleteBin(binId);
        if (isErr(result)) {
          lastError = result.error;
        } else {
          successCount++;
        }
      }
    });

    clearSelection();
    setSelectedBins([]);

    if (successCount > 0) {
      addToast(t('toast.binDeletedMulti', { count: successCount }), 'success');
      announceToScreenReader(`Deleted ${successCount} bins`);
    }
    if (lastError) {
      addToast(t('toast.binDeleteFailed', { error: getUserMessage(lastError) }), 'error');
    }
  }, [
    selectedBinIds,
    layout,
    execute,
    deleteBin,
    clearSelection,
    setSelectedBins,
    addToast,
    announceToScreenReader,
    t,
  ]);

  const changeBulkCategory = useCallback(
    (categoryId: string) => {
      if (selectedBinIds.length === 0) return;

      // Filter to only bins that actually change
      const binsToUpdate = findBinsByIds(layout, selectedBinIds).filter(
        (bin) => bin.category !== categoryId
      );
      if (binsToUpdate.length === 0) return;

      const category = printList.categories.find((c) => c.id === categoryId);

      let successCount = 0;
      let lastError: LayoutError | null = null;

      execute(() => {
        for (const bin of binsToUpdate) {
          const result = updateBin(bin.id, { category: categoryId });
          if (isErr(result)) {
            lastError = result.error;
          } else {
            successCount++;
          }
        }
      });

      // Track once per batch (not per bin)
      if (category && successCount > 0) {
        mlTracking.trackCategory(binsToUpdate[0], category.name, successCount);
      }

      clearSelection();
      if (successCount > 0) {
        addToast(
          `Changed ${successCount} bin${successCount !== 1 ? 's' : ''} to ${category?.name || 'category'}`,
          'success'
        );
        announceToScreenReader(`Changed category for ${successCount} bins`);
      }
      if (lastError) {
        addToast(t('toast.binUpdateFailed', { error: getUserMessage(lastError) }), 'error');
      }
    },
    [
      selectedBinIds,
      layout,
      printList.categories,
      execute,
      updateBin,
      clearSelection,
      addToast,
      announceToScreenReader,
      t,
    ]
  );

  const updateBulkLabel = useCallback(
    (label: string) => {
      if (selectedBinIds.length === 0) return;

      let successCount = 0;
      let lastError: LayoutError | null = null;

      execute(() => {
        for (const binId of selectedBinIds) {
          const bin = layout.bins.find((b) => b.id === binId);
          if (bin) {
            const oldLabel = bin.label;
            const result = updateBin(binId, { label });
            if (isErr(result)) {
              lastError = result.error;
            } else {
              successCount++;
              mlTracking.trackLabel(bin, oldLabel, label);
            }
          }
        }
      });

      if (successCount > 0) {
        addToast(
          `Updated label for ${successCount} bin${successCount !== 1 ? 's' : ''}`,
          'success'
        );
        if (label.trim()) {
          markFeatureUsed('labels');
        }
      }
      if (lastError) {
        addToast(t('toast.binUpdateFailed', { error: getUserMessage(lastError) }), 'error');
      }
    },
    [selectedBinIds, layout.bins, execute, updateBin, addToast, t]
  );

  const updateBulkNotes = useCallback(
    (notes: string) => {
      if (selectedBinIds.length === 0) return;

      let successCount = 0;
      let lastError: LayoutError | null = null;

      execute(() => {
        for (const binId of selectedBinIds) {
          const result = updateBin(binId, { notes });
          if (isErr(result)) {
            lastError = result.error;
          } else {
            successCount++;
          }
        }
      });

      if (successCount > 0) {
        addToast(
          `Updated notes for ${successCount} bin${successCount !== 1 ? 's' : ''}`,
          'success'
        );
      }
      if (lastError) {
        addToast(t('toast.binUpdateFailed', { error: getUserMessage(lastError) }), 'error');
      }
    },
    [selectedBinIds, execute, updateBin, addToast, t]
  );

  // Inline editing handlers (for specific bin IDs, not selection-based)
  const updateBinLabel = useCallback(
    (binIds: string[], label: string) => {
      if (binIds.length === 0) return;

      let successCount = 0;
      let lastError: LayoutError | null = null;

      execute(() => {
        for (const binId of binIds) {
          const bin = layout.bins.find((b) => b.id === binId);
          if (bin) {
            const oldLabel = bin.label;
            const result = updateBin(binId, { label });
            if (isErr(result)) {
              lastError = result.error;
            } else {
              successCount++;
              mlTracking.trackLabel(bin, oldLabel, label);
            }
          }
        }
      });

      if (successCount > 0) {
        addToast(
          `Updated label for ${successCount} bin${successCount !== 1 ? 's' : ''}`,
          'success'
        );
      }
      if (lastError) {
        addToast(t('toast.binUpdateFailed', { error: getUserMessage(lastError) }), 'error');
      }
    },
    [layout.bins, execute, updateBin, addToast, t]
  );

  const updateBinNotes = useCallback(
    (binIds: string[], notes: string) => {
      if (binIds.length === 0) return;

      let successCount = 0;
      let lastError: LayoutError | null = null;

      execute(() => {
        for (const binId of binIds) {
          const result = updateBin(binId, { notes });
          if (isErr(result)) {
            lastError = result.error;
          } else {
            successCount++;
          }
        }
      });

      if (successCount > 0) {
        addToast(
          `Updated notes for ${successCount} bin${successCount !== 1 ? 's' : ''}`,
          'success'
        );
      }
      if (lastError) {
        addToast(t('toast.binUpdateFailed', { error: getUserMessage(lastError) }), 'error');
      }
    },
    [execute, updateBin, addToast, t]
  );

  // Export handlers
  const exportToTSV = useCallback(() => {
    return exportPrintListTSV(filteredRows, {
      gridUnitMm: layout.gridUnitMm,
      categories: layout.categories,
    });
  }, [filteredRows, layout.gridUnitMm, layout.categories]);

  const exportToCSV = useCallback(() => {
    return formatAsCSV(filteredRows, {
      gridUnitMm: layout.gridUnitMm,
      categories: layout.categories,
    });
  }, [filteredRows, layout.gridUnitMm, layout.categories]);

  const exportToJSON = useCallback(() => {
    return formatAsJSON(filteredRows, layout);
  }, [filteredRows, layout]);

  const downloadExport = useCallback(
    (format: 'tsv' | 'csv' | 'json', filename?: string) => {
      const baseName =
        filename || layout.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'bin-list';

      let content: string;
      let extension: string;
      let mimeType: string;

      switch (format) {
        case 'tsv':
          content = exportToTSV();
          extension = 'tsv';
          mimeType = 'text/tab-separated-values';
          mlTracking.trackSnapshot('export_tsv');
          mlTracking.trackQuality('exported');
          break;
        case 'csv':
          content = exportToCSV();
          extension = 'csv';
          mimeType = 'text/csv';
          mlTracking.trackSnapshot('export_tsv'); // CSV is similar quality signal
          mlTracking.trackQuality('exported');
          break;
        case 'json':
          content = exportToJSON();
          extension = 'json';
          mimeType = 'application/json';
          mlTracking.trackSnapshot('export_json');
          mlTracking.trackQuality('exported');
          break;
      }

      downloadAsFile(content, `${baseName}.${extension}`, mimeType);
      addToast(t('toast.downloadedFile', { format: extension.toUpperCase() }), 'success');
    },
    [exportToTSV, exportToCSV, exportToJSON, layout.name, addToast, t]
  );

  const copyToClipboardFn = useCallback(
    async (format: 'tsv' | 'csv' | 'json'): Promise<boolean> => {
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
        addToast(t('toast.copiedFormat', { format: format.toUpperCase() }), 'success');
        return true;
      } catch {
        addToast(t('toast.copyFailed'), 'error');
        return false;
      }
    },
    [exportToTSV, exportToCSV, exportToJSON, addToast, t]
  );

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
