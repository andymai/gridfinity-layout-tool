/**
 * Central hook for print list functionality.
 * Encapsulates data generation, filtering, sorting, grouping, and selection.
 */

import { useMemo, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore, useSettingsStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { calcMaxGridUnits } from '@/core/constants';
import { generateEnhancedPrintList, type PrintSplitFit } from '@/features/print-export/utils/split';
import { resolveBinOverhang } from '@/shared/utils/drawerMargin';
import { effectiveGridUnitMmY } from '@/core/types';
import {
  applyFiltersAndSort,
  groupByCategory,
} from '@/features/print-export/utils/printListOperations';
import {
  calcFilamentCost,
  calcSpoolPercentage,
  calcPrintTimeHours,
  estimatePrintJobs,
  DEFAULT_METERS_PER_KG,
} from '@/features/print-export/utils/printEstimates';
import type {
  EnhancedPrintRow,
  PrintListGroup,
  PrintListFilters,
  PrintListSortKey,
  PrintListConfig,
  CategoryId,
} from '@/core/types';
import { categoryId as toCategoryId } from '@/core/types';
import { useLabelPlateCounts } from '@/shared/hooks/useLabelPlateCounts';
import type { LabelPlateWidthU } from '@/shared/constants/labelPlates';
import { useTranslation } from '@/i18n';

const DEFAULT_FILTERS: PrintListFilters = {
  hiddenCategoryIds: new Set<CategoryId>(),
  sortKey: 'default',
  sortOrder: 'desc',
  groupByCategory: false,
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
  totalLabelPlates: number;
  /** Preformatted width breakdown, e.g. "8× 1U, 4× 2U". Empty when no plates. */
  labelPlateWidthSummary: string;

  // Filter/sort state
  filters: PrintListFilters;
  setSort: (key: PrintListSortKey) => void;
  toggleSortOrder: () => void;
  toggleCategoryVisibility: (categoryId: string) => void;
  toggleGroupByCategory: () => void;
  resetFilters: () => void;

  config: PrintListConfig;
  nozzleSizeMm: number;
  setFilamentCostPerKg: (cost: number) => void;

  selectBinsByRow: (row: EnhancedPrintRow) => void;

  // Categories (for filter UI)
  categories: { id: string; name: string; color: string }[];
}

export function usePrintList(): UsePrintListReturn {
  const t = useTranslation();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const printSettings = useSettingsStore((s) => s.settings.printSettings);

  // Derive config from global print settings
  const [configOverrides, setConfigOverrides] = useState<Partial<PrintListConfig>>({});
  const config: PrintListConfig = useMemo(
    () => ({
      filamentCostPerKg: configOverrides.filamentCostPerKg ?? printSettings.filamentCostPerKg,
      metersPerKg: configOverrides.metersPerKg ?? DEFAULT_METERS_PER_KG,
    }),
    [printSettings.filamentCostPerKg, configOverrides]
  );

  const { layout } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
    }))
  );

  const setSelectedBins = useSelectionStore((state) => state.setSelectedBins);

  // Bed capacity in whole grid units, for the per-plate job estimate below.
  // NOT the split limit — that is per bin, because an overhang is charged
  // against the bed before the capacity is derived (see `splitFit`).
  const maxGridUnits = calcMaxGridUnits(
    layout.printBedSize,
    layout.gridUnitMm,
    layout.printBedDepth
  );

  // The bed in mm plus the same per-bin overhang the exporter resolves, so the
  // listed pieces are the pieces the export actually writes. Memoized on
  // primitives: `baseRows` keys off this object, and a fresh identity every
  // render would rebuild the whole list on every render.
  const gridUnitMmY = effectiveGridUnitMmY(layout);
  const { printBedSize, printBedDepth, gridUnitMm, baseplateParams } = layout;
  const drawerWidth = layout.drawer.width;
  const drawerDepth = layout.drawer.depth;
  const splitFit = useMemo(
    (): PrintSplitFit => ({
      bedWidthMm: printBedSize,
      bedDepthMm: printBedDepth ?? printBedSize,
      gridUnitMm,
      gridUnitMmY,
      overhangFor: (bin) =>
        resolveBinOverhang(bin, { width: drawerWidth, depth: drawerDepth }, baseplateParams) ??
        undefined,
    }),
    [
      printBedSize,
      printBedDepth,
      gridUnitMm,
      gridUnitMmY,
      drawerWidth,
      drawerDepth,
      baseplateParams,
    ]
  );

  // Base enhanced rows (memoized - expensive operation)
  const baseRows = useMemo(
    () =>
      generateEnhancedPrintList(layout.bins, splitFit, printSettings, config, {
        gridUnitMm: layout.gridUnitMm,
        heightUnitMm: layout.heightUnitMm,
      }),
    [layout.bins, splitFit, printSettings, config, layout.gridUnitMm, layout.heightUnitMm]
  );

  // Label facts per linked design (async design loads; rows gain them as the
  // designs resolve): swappable plate counts, and whether the tabs will print
  // with nothing on them.
  const labelInfos = useLabelPlateCounts(layout.bins);
  const platedRows = useMemo(() => {
    if (labelInfos.size === 0) return baseRows;
    return baseRows.map((row) => {
      const info = row.linkedDesignId ? labelInfos.get(row.linkedDesignId) : undefined;
      if (!info) return row;
      return {
        ...row,
        ...(info.plateSet ? { labelPlateCount: info.plateSet.perBin * row.binCount } : {}),
        ...(info.tabsWithoutText ? { labelTabsWithoutText: true } : {}),
      };
    });
  }, [baseRows, labelInfos]);

  // Filtered and sorted rows
  const rows = useMemo(
    () =>
      applyFiltersAndSort(
        platedRows,
        filters.hiddenCategoryIds,
        filters.sortKey,
        filters.sortOrder
      ),
    [platedRows, filters.hiddenCategoryIds, filters.sortKey, filters.sortOrder]
  );

  // Grouped rows (only computed when grouping is enabled)
  const groupedRows = useMemo(() => {
    if (!filters.groupByCategory) return null;
    return groupByCategory(rows, layout.categories, t('print.uncategorized'));
  }, [rows, filters.groupByCategory, layout.categories, t]);

  // Compute all aggregates in a single memo to reduce memoization overhead
  const aggregates = useMemo(() => {
    const totalBins = rows.reduce((sum, r) => sum + r.binCount, 0);
    const totalPieces = rows.reduce((sum, r) => sum + r.totalPieces, 0);
    const totalFilament = Math.round(rows.reduce((sum, r) => sum + r.filament, 0) * 10) / 10;
    const hasAnySplits = rows.some((r) => r.needsSplit);

    // Overhead is per-plate, not per distinct bin type. Estimate plate count
    // from total bin footprint vs. how many grid cells fit on the bed.
    const totalFootprintUnits = rows.reduce((sum, r) => sum + r.area * r.binCount, 0);
    const bedCapacityUnits = maxGridUnits.width * maxGridUnits.depth;
    const numPrintJobs = estimatePrintJobs(totalFootprintUnits, bedCapacityUnits);

    const totalLabelPlates = rows.reduce((sum, r) => sum + (r.labelPlateCount ?? 0), 0);
    const plateWidthCounts = new Map<LabelPlateWidthU, number>();
    for (const r of rows) {
      const set = r.linkedDesignId ? labelInfos.get(r.linkedDesignId)?.plateSet : undefined;
      if (!set) continue;
      for (const u of set.widthsU) {
        plateWidthCounts.set(u, (plateWidthCounts.get(u) ?? 0) + r.binCount);
      }
    }
    const labelPlateWidthSummary = [...plateWidthCounts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([u, n]) => `${n}× ${u}U`)
      .join(', ');

    return {
      totalBins,
      totalPieces,
      totalFilament,
      totalCost: calcFilamentCost(totalFilament, config.filamentCostPerKg, config.metersPerKg),
      totalPrintTimeHours: calcPrintTimeHours(totalFilament, numPrintJobs, printSettings),
      spoolEstimate: Math.ceil((totalFilament / config.metersPerKg) * 10) / 10,
      spoolPercentage: calcSpoolPercentage(totalFilament, config.metersPerKg),
      hasAnySplits,
      totalLabelPlates,
      labelPlateWidthSummary,
    };
  }, [
    rows,
    labelInfos,
    config.filamentCostPerKg,
    config.metersPerKg,
    printSettings,
    maxGridUnits.width,
    maxGridUnits.depth,
  ]);

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

  const toggleCategoryVisibility = useCallback((rawCategoryId: string) => {
    const catId: CategoryId = toCategoryId(rawCategoryId);
    setFilters((f) => {
      const next = new Set(f.hiddenCategoryIds);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
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
    setConfigOverrides((c) => ({ ...c, filamentCostPerKg: Math.max(0, cost) }));
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
    nozzleSizeMm: printSettings.nozzleSizeMm,
    setFilamentCostPerKg,
    selectBinsByRow,
    categories: layout.categories,
  };
}
