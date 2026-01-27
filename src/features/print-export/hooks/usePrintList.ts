/**
 * Central hook for print list functionality.
 * Encapsulates data generation, filtering, sorting, grouping, and selection.
 */

import { useMemo, useState, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useUIStore } from '@/core/store';
import { calcMaxGridUnits } from '@/core/constants';
import { generateEnhancedPrintList } from '@/features/print-export/utils/split';
import {
  applyFiltersAndSort,
  groupByCategory,
} from '@/features/print-export/utils/printListOperations';
import {
  calcFilamentCost,
  calcSpoolPercentage,
  calcPrintTimeHours,
  DEFAULT_COST_PER_KG,
  DEFAULT_METERS_PER_KG,
} from '@/features/print-export/utils/printEstimates';
import type {
  EnhancedPrintRow,
  PrintListGroup,
  PrintListFilters,
  PrintListSortKey,
  PrintListConfig,
} from '@/core/types';

const DEFAULT_FILTERS: PrintListFilters = {
  hiddenCategoryIds: new Set(),
  sortKey: 'default',
  sortOrder: 'desc',
  groupByCategory: false,
};

const DEFAULT_CONFIG: PrintListConfig = {
  filamentCostPerKg: DEFAULT_COST_PER_KG,
  metersPerKg: DEFAULT_METERS_PER_KG,
};

export interface UsePrintListReturn {
  // Data
  rows: EnhancedPrintRow[];
  groupedRows: PrintListGroup[] | null;

  // Aggregates
  totalBins: number;
  totalPieces: number;
  totalFilament: number;
  totalCost: number;
  totalPrintTimeHours: number;
  spoolEstimate: number;
  spoolPercentage: number;
  hasAnySplits: boolean;

  // Filter/sort state
  filters: PrintListFilters;
  setSort: (key: PrintListSortKey) => void;
  toggleSortOrder: () => void;
  toggleCategoryVisibility: (categoryId: string) => void;
  toggleGroupByCategory: () => void;
  resetFilters: () => void;

  // Config
  config: PrintListConfig;
  setFilamentCostPerKg: (cost: number) => void;

  // Actions
  selectBinsByRow: (row: EnhancedPrintRow) => void;

  // Categories (for filter UI)
  categories: { id: string; name: string; color: string }[];
}

export function usePrintList(): UsePrintListReturn {
  const [filters, setFilters] = useState<PrintListFilters>(DEFAULT_FILTERS);
  const [config, setConfig] = useState<PrintListConfig>(DEFAULT_CONFIG);

  const { layout } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
    }))
  );

  const { setSelectedBins } = useUIStore(
    useShallow((state) => ({
      setSelectedBins: state.setSelectedBins,
    }))
  );

  const maxGridUnits = calcMaxGridUnits(layout.printBedSize, layout.gridUnitMm);

  // Base enhanced rows (memoized - expensive operation)
  const baseRows = useMemo(
    () => generateEnhancedPrintList(layout.bins, maxGridUnits, layout.heightUnitMm, config),
    [layout.bins, maxGridUnits, layout.heightUnitMm, config]
  );

  // Filtered and sorted rows
  const rows = useMemo(
    () =>
      applyFiltersAndSort(baseRows, filters.hiddenCategoryIds, filters.sortKey, filters.sortOrder),
    [baseRows, filters.hiddenCategoryIds, filters.sortKey, filters.sortOrder]
  );

  // Grouped rows (only computed when grouping is enabled)
  const groupedRows = useMemo(() => {
    if (!filters.groupByCategory) return null;
    return groupByCategory(rows, layout.categories);
  }, [rows, filters.groupByCategory, layout.categories]);

  // Compute all aggregates in a single memo to reduce memoization overhead
  const aggregates = useMemo(() => {
    const totalBins = rows.reduce((sum, r) => sum + r.binCount, 0);
    const totalPieces = rows.reduce((sum, r) => sum + r.totalPieces, 0);
    const totalFilament = Math.round(rows.reduce((sum, r) => sum + r.filament, 0) * 10) / 10;
    const hasAnySplits = rows.some((r) => r.needsSplit);

    return {
      totalBins,
      totalPieces,
      totalFilament,
      totalCost: calcFilamentCost(totalFilament, config.filamentCostPerKg, config.metersPerKg),
      totalPrintTimeHours: calcPrintTimeHours(totalFilament, rows.length),
      spoolEstimate: Math.ceil((totalFilament / config.metersPerKg) * 10) / 10,
      spoolPercentage: calcSpoolPercentage(totalFilament, config.metersPerKg),
      hasAnySplits,
    };
  }, [rows, config.filamentCostPerKg, config.metersPerKg]);

  // Actions
  const setSort = useCallback((key: PrintListSortKey) => {
    setFilters((f) => ({
      ...f,
      sortKey: key,
      // Toggle order if same key clicked again
      sortOrder: f.sortKey === key && f.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  const toggleSortOrder = useCallback(() => {
    setFilters((f) => ({ ...f, sortOrder: f.sortOrder === 'asc' ? 'desc' : 'asc' }));
  }, []);

  const toggleCategoryVisibility = useCallback((categoryId: string) => {
    setFilters((f) => {
      const next = new Set(f.hiddenCategoryIds);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return { ...f, hiddenCategoryIds: next };
    });
  }, []);

  const toggleGroupByCategory = useCallback(() => {
    setFilters((f) => ({ ...f, groupByCategory: !f.groupByCategory }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const setFilamentCostPerKg = useCallback((cost: number) => {
    setConfig((c) => ({ ...c, filamentCostPerKg: Math.max(0, cost) }));
  }, []);

  const selectBinsByRow = useCallback(
    (row: EnhancedPrintRow) => {
      setSelectedBins(row.binIds);
    },
    [setSelectedBins]
  );

  return {
    rows,
    groupedRows,
    ...aggregates,
    filters,
    setSort,
    toggleSortOrder,
    toggleCategoryVisibility,
    toggleGroupByCategory,
    resetFilters,
    config,
    setFilamentCostPerKg,
    selectBinsByRow,
    categories: layout.categories,
  };
}
