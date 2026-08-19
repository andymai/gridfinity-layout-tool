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
  DesignId,
} from '@/core/types';
import type { OverhangConfig } from '@/shared/types/bin';
import { getGridBins } from '@/shared/utils';
import { getSplitPositions } from '@/shared/utils/splitPositions';
import { binSplitChunkUnits } from '@/shared/utils/binSplitFit';
import { overhangKey, resolveOverhang } from '@/shared/utils/overhang';
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
 * Piece size along one axis, in grid units — the SAME partition the exporter
 * cuts, read from the same helper it uses.
 *
 * The print list used to derive its own by recursive uneven halving, which
 * agreed with the exporter only by coincidence. A 5-unit bin was listed as a
 * 3 plus a 2 where the exporter emits two 2.5s, and at 10 and 12 units the
 * halving produced a whole EXTRA piece (4 against 3) — over-reporting the piece
 * count, and with it the filament, cost and print-time totals built on top.
 *
 * Pieces are equal by construction, so an axis is fully described by one size
 * and a count.
 */
function axisPieces(size: number, maxSize: number): { size: number; count: number } {
  const count = getSplitPositions(size, maxSize).length + 1;
  // An even split into 3 is a repeating fraction, which is a real piece size
  // (the exporter cuts exactly there) but not one to print at float precision.
  // The rounding is display-only: it moves a 10-unit third by 0.0014mm.
  return { size: Math.round((size / count) * 100) / 100, count };
}

/**
 * The pieces a bin is cut into to fit the plate: a regular grid of equal
 * pieces, `widthPieces x depthPieces`, matching what the exporter builds.
 *
 * `maxWidth`/`maxDepth` are the largest chunk each axis may be cut into — pass
 * `binSplitChunkUnits`, which charges the bin's overhang, rather than a bare
 * bed capacity.
 */
export function splitBinSize(
  width: number,
  depth: number,
  maxWidth: number,
  maxDepth: number = maxWidth
): PrintPiece[] {
  const w = axisPieces(width, maxWidth);
  const d = axisPieces(depth, maxDepth);
  return [{ width: w.size as GridUnits, depth: d.size as GridUnits, count: w.count * d.count }];
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
 * Everything the split plan needs, in the terms the exporter states it.
 *
 * The bed is in MILLIMETRES rather than pre-divided grid units on purpose: an
 * overhang grows a bin's body in mm past its footprint, so a bin whose units fit
 * can still overrun the plate, and a capacity already reduced to units has
 * thrown away what that would be charged against.
 */
export interface PrintSplitFit {
  readonly bedWidthMm: number;
  readonly bedDepthMm: number;
  readonly gridUnitMm: number;
  readonly gridUnitMmY: number;
  /**
   * The overhang a placed bin carries, resolved the way the exporter resolves
   * it (`resolveBinOverhang`). Two placements of one design with different
   * overhangs are different printed parts, so this also keys the grouping —
   * mirroring the layout export's `designId|overhangKey`.
   *
   * Omit for a plain capacity check.
   */
  readonly overhangFor?: (bin: Bin) => OverhangConfig | undefined;
}

/** Chunk limit and grouping key for one bin's split. */
function fitForBin(
  bin: Bin,
  fit: PrintSplitFit
): { maxWidth: number; maxDepth: number; key: string } {
  const overhang = fit.overhangFor?.(bin);
  const limit = binSplitChunkUnits(
    {
      width: bin.width,
      depth: bin.depth,
      gridUnitMm: fit.gridUnitMm,
      gridUnitMmY: fit.gridUnitMmY,
      overhang,
    },
    fit.bedWidthMm,
    fit.bedDepthMm
  );
  return {
    maxWidth: limit.width,
    maxDepth: limit.depth,
    key: overhangKey(resolveOverhang(overhang)),
  };
}

/**
 * Generate the print list from bins.
 * Groups bins by size×height×label×category×overhang, calculates split pieces.
 * Bins with the same dimensions AND label AND category are consolidated with quantity counts.
 * Notes and custom properties are merged (unique values joined with "; ").
 */
export function generatePrintList(
  bins: Bin[],
  fit: PrintSplitFit,
  printSettings: PrintSettings = DEFAULT_PRINT_SETTINGS,
  layoutUnits?: { gridUnitMm: number; heightUnitMm: number }
): PrintRow[] {
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
      linkedDesignId?: DesignId;
      maxWidth: number;
      maxDepth: number;
    }
  >();

  for (const bin of placedBins) {
    // Consolidate bins with same size + height + label + category + linked
    // design + overhang. Link identity matters: two designs with identical
    // dimensions (e.g. an imported mesh next to a parametric bin) are different
    // printed parts and must not merge into one row. So does the overhang: the
    // same design against a padded drawer edge and away from it are two parts,
    // and only one of them may need cutting.
    const binFit = fitForBin(bin, fit);
    const key = `${bin.width}×${bin.depth}×${bin.height}:${bin.category}:${bin.label || ''}:${bin.linkedDesignId ?? ''}:${binFit.key}`;
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
        linkedDesignId: bin.linkedDesignId,
        maxWidth: binFit.maxWidth,
        maxDepth: binFit.maxDepth,
      });
    }
  }

  const rows: PrintRow[] = [];

  for (const [, group] of groups) {
    const pieces = splitBinSize(group.width, group.depth, group.maxWidth, group.maxDepth);
    const mergedPieces = mergePieces(pieces);
    const needsSplit = group.width > group.maxWidth || group.depth > group.maxDepth;
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
      linkedDesignId: group.linkedDesignId,
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
  fit: PrintSplitFit,
  printSettings: PrintSettings = DEFAULT_PRINT_SETTINGS,
  config: PrintListConfig = {
    filamentCostPerKg: DEFAULT_COST_PER_KG,
    metersPerKg: DEFAULT_METERS_PER_KG,
  },
  layoutUnits?: { gridUnitMm: number; heightUnitMm: number }
): EnhancedPrintRow[] {
  const baseRows = generatePrintList(bins, fit, printSettings, layoutUnits);

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
