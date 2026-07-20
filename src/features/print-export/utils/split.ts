import type {
  Bin,
  GridUnits,
  HeightUnits,
  PrintPiece,
  PrintRow,
  EnhancedPrintRow,
  PrintListConfig,
  BinId,
  CategoryId,
} from '@/core/types';
import { getGridBins } from '@/shared/utils';
import {
  calcFilamentCost,
  calcSpoolPercentage,
  DEFAULT_METERS_PER_KG,
  DEFAULT_COST_PER_KG,
} from '@/features/print-export/utils/printEstimates';
import {
  estimateStandardBinFilament,
  DEFAULT_PRINT_SETTINGS,
  type PrintSettings,
} from '@/shared/printSettings';

/**
 * Split a dimension in half, rounding appropriately.
 * - For integer dimensions: ceil gives larger piece (5→3), floor gives smaller (5→2)
 * - For fractional dimensions (half-bin mode): uses 0.5-aware rounding
 *
 * @param dimension The original dimension being split
 * @param useCeil If true, round up; if false, round down
 */
function splitHalf(dimension: number, useCeil: boolean): number {
  const half = dimension / 2;

  // If original dimension is a whole number, use integer rounding
  if (Number.isInteger(dimension)) {
    return useCeil ? Math.ceil(half) : Math.floor(half);
  }

  // For fractional dimensions (half-bin mode), use 0.5-aware rounding
  return useCeil ? Math.ceil(half * 2) / 2 : Math.floor(half * 2) / 2;
}

/**
 * Recursively split a bin size until all pieces fit within maxSize.
 * Uses greedy halving strategy from PRD.
 * Supports fractional dimensions (0.5 increments) for half-bin mode.
 *
 * Examples (maxSize = 4):
 * - 5×3 → [3×3, 2×3]
 * - 9×3 → [5×3, 4×3] → [3×3, 2×3, 4×3]
 * - 5×6 → [3×3, 2×3, 3×3, 2×3]
 * - 1.5×1.5 (maxSize=1) → [1×1, 0.5×1, 1×0.5, 0.5×0.5]
 */
export function splitBinSize(
  width: number,
  depth: number,
  maxWidth: number,
  maxDepth: number = maxWidth
): PrintPiece[] {
  if (width <= maxWidth && depth <= maxDepth) {
    return [{ width: width as GridUnits, depth: depth as GridUnits, count: 1 }];
  }

  const pieces: PrintPiece[] = [];

  if (width > maxWidth && depth <= maxDepth) {
    // Split width only - preserves integer vs fractional behavior
    const left = splitHalf(width, true);
    const right = splitHalf(width, false);
    pieces.push(...splitBinSize(left, depth, maxWidth, maxDepth));
    if (right > 0) {
      pieces.push(...splitBinSize(right, depth, maxWidth, maxDepth));
    }
  } else if (width <= maxWidth && depth > maxDepth) {
    // Split depth only
    const top = splitHalf(depth, true);
    const bottom = splitHalf(depth, false);
    pieces.push(...splitBinSize(width, top, maxWidth, maxDepth));
    if (bottom > 0) {
      pieces.push(...splitBinSize(width, bottom, maxWidth, maxDepth));
    }
  } else {
    // Split both dimensions
    const leftW = splitHalf(width, true);
    const rightW = splitHalf(width, false);
    const topD = splitHalf(depth, true);
    const bottomD = splitHalf(depth, false);

    pieces.push(...splitBinSize(leftW, topD, maxWidth, maxDepth));
    if (rightW > 0) pieces.push(...splitBinSize(rightW, topD, maxWidth, maxDepth));
    if (bottomD > 0) pieces.push(...splitBinSize(leftW, bottomD, maxWidth, maxDepth));
    if (rightW > 0 && bottomD > 0)
      pieces.push(...splitBinSize(rightW, bottomD, maxWidth, maxDepth));
  }

  return pieces.filter((p) => p.width > 0 && p.depth > 0);
}

/**
 * Merge identical pieces to consolidate counts.
 */
function mergePieces(pieces: PrintPiece[]): PrintPiece[] {
  const map = new Map<string, PrintPiece>();

  for (const piece of pieces) {
    const key = `${piece.width}×${piece.depth}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += piece.count;
    } else {
      map.set(key, { ...piece });
    }
  }

  return Array.from(map.values());
}

/**
 * Merge unique values from an array, filtering empty strings.
 * Used for consolidating notes and custom property values.
 */
function mergeUniqueValues(values: string[], separator = '; '): string {
  const unique = new Set<string>();
  for (const v of values) {
    const trimmed = v.trim();
    if (trimmed) {
      unique.add(trimmed);
    }
  }
  return Array.from(unique).join(separator);
}

/**
 * Merge custom properties from multiple bins.
 * Values for the same key are concatenated with "; " separator (unique only).
 */
function mergeCustomProperties(
  propsList: Array<Record<string, string> | undefined>
): Record<string, string> | undefined {
  const merged = new Map<string, Set<string>>();

  for (const props of propsList) {
    if (!props) continue;
    for (const [key, value] of Object.entries(props)) {
      const trimmed = value.trim();
      if (!trimmed) continue;
      const existing = merged.get(key);
      if (existing) {
        existing.add(trimmed);
      } else {
        merged.set(key, new Set([trimmed]));
      }
    }
  }

  if (merged.size === 0) return undefined;

  const result: Record<string, string> = {};
  for (const [key, values] of merged) {
    result[key] = Array.from(values).join('; ');
  }
  return result;
}

/**
 * Generate the print list from bins.
 * Groups bins by size×height×label×category, calculates split pieces.
 * Bins with the same dimensions AND label AND category are consolidated with quantity counts.
 * Notes and custom properties are merged (unique values joined with "; ").
 */
export function generatePrintList(
  bins: Bin[],
  maxPrintSize: number | { width: number; depth: number },
  printSettings: PrintSettings = DEFAULT_PRINT_SETTINGS,
  layoutUnits?: { gridUnitMm: number; heightUnitMm: number }
): PrintRow[] {
  const maxW = typeof maxPrintSize === 'number' ? maxPrintSize : maxPrintSize.width;
  const maxD = typeof maxPrintSize === 'number' ? maxPrintSize : maxPrintSize.depth;
  const placedBins = getGridBins(bins);

  // Group by size, height, label, and category (consolidate same dimensions + label + category)
  const groups = new Map<
    string,
    {
      width: number;
      depth: number;
      height: number;
      count: number;
      categoryId: CategoryId;
      label: string;
      notesList: string[]; // Collect all notes for merging
      binIds: BinId[];
      customPropertiesList: Array<Record<string, string> | undefined>; // Collect for merging
    }
  >();

  for (const bin of placedBins) {
    // Consolidate bins with same size + height + label + category + linked
    // design. Link identity matters: two designs with identical dimensions
    // (e.g. an imported mesh next to a parametric bin) are different printed
    // parts and must not merge into one row.
    const key = `${bin.width}×${bin.depth}×${bin.height}:${bin.category}:${bin.label || ''}:${bin.linkedDesignId ?? ''}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      existing.binIds.push(bin.id);
      existing.notesList.push(bin.notes);
      existing.customPropertiesList.push(bin.customProperties);
    } else {
      groups.set(key, {
        width: bin.width,
        depth: bin.depth,
        height: bin.height,
        count: 1,
        categoryId: bin.category,
        label: bin.label,
        notesList: [bin.notes],
        binIds: [bin.id],
        customPropertiesList: [bin.customProperties],
      });
    }
  }

  // Generate print rows
  const rows: PrintRow[] = [];

  for (const [, group] of groups) {
    const pieces = splitBinSize(group.width, group.depth, maxW, maxD);
    const mergedPieces = mergePieces(pieces);
    const needsSplit = group.width > maxW || group.depth > maxD;
    const totalPieces = mergedPieces.reduce((sum, p) => sum + p.count, 0) * group.count;

    // Calculate filament for all pieces in this row (analytical volume model)
    const filamentPerBin = mergedPieces.reduce(
      (sum, p) =>
        sum +
        estimateStandardBinFilament(
          p.width,
          p.depth,
          group.height,
          printSettings,
          layoutUnits?.gridUnitMm,
          layoutUnits?.heightUnitMm
        ).metersFilament *
          p.count,
      0
    );
    const filament = Math.round(filamentPerBin * group.count * 100) / 100;

    // Merge notes and custom properties from all bins in the group
    const mergedNotes = mergeUniqueValues(group.notesList);
    const mergedCustomProps = mergeCustomProperties(group.customPropertiesList);

    rows.push({
      size: `${group.width}×${group.depth}`,
      height: group.height as HeightUnits,
      binCount: group.count,
      pieces: mergedPieces,
      totalPieces,
      needsSplit,
      filament,
      categoryIds: [group.categoryId],
      labels: group.label ? [group.label] : [],
      notes: mergedNotes,
      binIds: group.binIds,
      customProperties: mergedCustomProps,
    });
  }

  // Sort by total area descending (batch efficiency)
  // Use parseFloat to support fractional bin sizes (half-bin mode)
  rows.sort((a, b) => {
    const areaA = parseFloat(a.size.split('×')[0]) * parseFloat(a.size.split('×')[1]) * a.binCount;
    const areaB = parseFloat(b.size.split('×')[0]) * parseFloat(b.size.split('×')[1]) * b.binCount;
    return areaB - areaA;
  });

  return rows;
}

/**
 * Calculate total pieces across all rows.
 */
export function getTotalPieces(rows: PrintRow[]): number {
  return rows.reduce((sum, row) => sum + row.totalPieces, 0);
}

/**
 * Calculate total bins across all rows.
 */
export function getTotalBins(rows: PrintRow[]): number {
  return rows.reduce((sum, row) => sum + row.binCount, 0);
}

/**
 * Calculate total filament in meters across all rows.
 */
export function getTotalFilament(rows: PrintRow[]): number {
  return Math.round(rows.reduce((sum, row) => sum + row.filament, 0) * 10) / 10;
}

/**
 * Estimate number of spools needed (standard 1kg spool ≈ 330m of PLA).
 */
export function getSpoolEstimate(totalFilament: number): number {
  const METERS_PER_SPOOL = 330;
  return Math.ceil((totalFilament / METERS_PER_SPOOL) * 10) / 10; // Round up to 0.1
}

/**
 * Generate enhanced print list with cost estimates and area calculations.
 * Extends the base PrintRow with additional computed fields for sorting and display.
 */
export function generateEnhancedPrintList(
  bins: Bin[],
  maxPrintSize: number | { width: number; depth: number },
  printSettings: PrintSettings = DEFAULT_PRINT_SETTINGS,
  config: PrintListConfig = {
    filamentCostPerKg: DEFAULT_COST_PER_KG,
    metersPerKg: DEFAULT_METERS_PER_KG,
  },
  layoutUnits?: { gridUnitMm: number; heightUnitMm: number }
): EnhancedPrintRow[] {
  const baseRows = generatePrintList(bins, maxPrintSize, printSettings, layoutUnits);

  return baseRows.map((row) => {
    const [width, depth] = row.size.split('×').map(Number);
    const area = width * depth;

    return {
      ...row,
      area,
      costEstimate: calcFilamentCost(row.filament, config.filamentCostPerKg, config.metersPerKg),
      spoolPercentage: calcSpoolPercentage(row.filament, config.metersPerKg),
    };
  });
}
