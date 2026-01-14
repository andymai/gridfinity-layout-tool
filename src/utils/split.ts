import type { Bin, PrintPiece, PrintRow, EnhancedPrintRow, PrintListConfig } from '../types';
import { STAGING_ID } from '../constants';
import { calcFilamentCost, calcSpoolPercentage, DEFAULT_METERS_PER_KG, DEFAULT_COST_PER_KG } from './printEstimates';


// Default height unit size in mm (used as reference for scaling)
const DEFAULT_HEIGHT_UNIT_MM = 7;

/**
 * Estimate filament usage in meters for a single bin.
 *
 * Calibrated against real Prusa Slicer data:
 * - 4×4×3u light bin = 11.67m (walls only, minimal base)
 * - We target ~15m for "typical" bin (middle ground between light and filled/dividers)
 *
 * Formula uses grid units directly:
 * - Base: 0.5m per grid unit² (floor, stacking features, internal structure)
 * - Walls: 0.15m per perimeter unit per height unit (scaled by heightUnitMm)
 *
 * Examples (at default 7mm height units):
 * - 1×1×3u: 0.5 + 1.8 = 2.3m
 * - 2×2×3u: 2 + 3.6 = 5.6m
 * - 4×4×3u: 8 + 7.2 = 15.2m (vs 11.67m light = ~30% buffer for dividers)
 */
function calcFilament(
  width: number,
  depth: number,
  height: number,
  heightUnitMm: number
): number {
  // Base: floor, stacking lip, and internal grid structure
  const baseContribution = 0.5 * width * depth;

  // Walls: perimeter walls scaled by height
  // Scale the wall coefficient by heightUnitMm so taller height units use more filament
  const perimeter = 2 * (width + depth);
  const wallCoefficient = 0.15 * (heightUnitMm / DEFAULT_HEIGHT_UNIT_MM);
  const wallContribution = wallCoefficient * perimeter * height;

  return Math.round((baseContribution + wallContribution) * 10) / 10;
}

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
export function splitBinSize(width: number, depth: number, maxSize: number): PrintPiece[] {
  if (width <= maxSize && depth <= maxSize) {
    return [{ width, depth, count: 1 }];
  }

  const pieces: PrintPiece[] = [];

  if (width > maxSize && depth <= maxSize) {
    // Split width only - preserves integer vs fractional behavior
    const left = splitHalf(width, true);
    const right = splitHalf(width, false);
    pieces.push(...splitBinSize(left, depth, maxSize));
    if (right > 0) {
      pieces.push(...splitBinSize(right, depth, maxSize));
    }
  } else if (width <= maxSize && depth > maxSize) {
    // Split depth only
    const top = splitHalf(depth, true);
    const bottom = splitHalf(depth, false);
    pieces.push(...splitBinSize(width, top, maxSize));
    if (bottom > 0) {
      pieces.push(...splitBinSize(width, bottom, maxSize));
    }
  } else {
    // Split both dimensions
    const leftW = splitHalf(width, true);
    const rightW = splitHalf(width, false);
    const topD = splitHalf(depth, true);
    const bottomD = splitHalf(depth, false);

    pieces.push(...splitBinSize(leftW, topD, maxSize));
    if (rightW > 0) pieces.push(...splitBinSize(rightW, topD, maxSize));
    if (bottomD > 0) pieces.push(...splitBinSize(leftW, bottomD, maxSize));
    if (rightW > 0 && bottomD > 0) pieces.push(...splitBinSize(rightW, bottomD, maxSize));
  }

  return pieces.filter(p => p.width > 0 && p.depth > 0);
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
 * Check if a bin has custom properties (non-empty object).
 */
function hasCustomProperties(bin: Bin): boolean {
  return bin.customProperties !== undefined && Object.keys(bin.customProperties).length > 0;
}

/**
 * Generate the print list from bins.
 * Groups bins by size×height, calculates split pieces.
 * Bins with labels or custom properties get their own rows.
 */
export function generatePrintList(
  bins: Bin[],
  maxPrintSize: number,
  heightUnitMm: number = DEFAULT_HEIGHT_UNIT_MM
): PrintRow[] {
  const placedBins = bins.filter(b => b.layerId !== STAGING_ID);

  // Group by size, height, category. Labeled bins and bins with custom properties get their own rows.
  const groups = new Map<string, {
    width: number;
    depth: number;
    height: number;
    count: number;
    categoryId: string;
    label: string;
    notes: string;
    binIds: string[];
    customProperties?: Record<string, string>;
  }>();

  for (const bin of placedBins) {
    // Labeled bins and bins with custom properties get their own row
    const isIndividual = bin.label || hasCustomProperties(bin);
    const key = isIndividual
      ? `${bin.width}×${bin.depth}×${bin.height}:${bin.category}:${bin.id}` // Unique key
      : `${bin.width}×${bin.depth}×${bin.height}:${bin.category}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      existing.binIds.push(bin.id);
    } else {
      groups.set(key, {
        width: bin.width,
        depth: bin.depth,
        height: bin.height,
        count: 1,
        categoryId: bin.category,
        label: bin.label,
        notes: bin.notes,
        binIds: [bin.id],
        customProperties: bin.customProperties,
      });
    }
  }

  // Generate print rows
  const rows: PrintRow[] = [];

  for (const [, group] of groups) {
    const pieces = splitBinSize(group.width, group.depth, maxPrintSize);
    const mergedPieces = mergePieces(pieces);
    const needsSplit = group.width > maxPrintSize || group.depth > maxPrintSize;
    const totalPieces = mergedPieces.reduce((sum, p) => sum + p.count, 0) * group.count;

    // Calculate filament for all pieces in this row
    const filamentPerBin = mergedPieces.reduce(
      (sum, p) => sum + calcFilament(p.width, p.depth, group.height, heightUnitMm) * p.count,
      0
    );
    const filament = Math.round(filamentPerBin * group.count * 10) / 10; // Round to 1 decimal

    rows.push({
      size: `${group.width}×${group.depth}`,
      height: group.height,
      binCount: group.count,
      pieces: mergedPieces,
      totalPieces,
      needsSplit,
      filament,
      categoryIds: [group.categoryId],
      labels: group.label ? [group.label] : [],
      notes: group.notes,
      binIds: group.binIds,
      customProperties: group.customProperties,
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
  return Math.ceil(totalFilament / METERS_PER_SPOOL * 10) / 10; // Round up to 0.1
}

/**
 * Generate enhanced print list with cost estimates and area calculations.
 * Extends the base PrintRow with additional computed fields for sorting and display.
 */
export function generateEnhancedPrintList(
  bins: Bin[],
  maxPrintSize: number,
  heightUnitMm: number = DEFAULT_HEIGHT_UNIT_MM,
  config: PrintListConfig = { filamentCostPerKg: DEFAULT_COST_PER_KG, metersPerKg: DEFAULT_METERS_PER_KG }
): EnhancedPrintRow[] {
  const baseRows = generatePrintList(bins, maxPrintSize, heightUnitMm);

  return baseRows.map(row => {
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
