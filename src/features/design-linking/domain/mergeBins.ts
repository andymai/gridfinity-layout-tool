/**
 * Merge a set of layout bins into one divided bin design.
 *
 * A layout layer and a `CompartmentConfig` describe the same thing from
 * opposite ends: rectangles tiling a uniform grid. This converts the former
 * into the latter, so a drawer planned bin-by-bin can be printed as a single
 * insert whose dividers sit where the bin walls were.
 *
 * Deliberately produces a RECTANGULAR bin — never a `cellMask` footprint.
 * `featuresStage` runs only `supportsCellMask` builders on a masked bin, and
 * neither `compartmentWallsFeature` nor `labelTabsFeature` declares it, so a
 * masked merge would export as an undivided shell with no dividers and no
 * tabs, silently. See `compartmentBuilder.scenario.polygonGap.test.ts`.
 * Cells no bin covers therefore become their own compartments rather than
 * holes, which is also why the caller must confirm a non-rectangular
 * selection before merging.
 */

import type { Bin, Layout } from '@/core/types';
import type { BinId } from '@/core/types';
import type { BinParams } from '@/features/bin-designer';
import type { Result } from '@/core/result';
import { ok, err, isOk } from '@/core/result';
import { effectiveGridUnitMmY } from '@/core/types';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_SPLIT_CONNECTOR_CONFIG,
  DESIGNER_CONSTRAINTS,
} from '@/shared/constants/bin';
import {
  normalizeIdsWithRemap,
  remapCompartmentTexts,
  validateBinParams,
} from '@/features/bin-designer';

/** Half-grid is the finest placement the layout allows, so edges are integers here. */
const HALF_UNITS_PER_GRID = 2;

/** Divider wall thickness (mm) for the merged piece — the designer default. */
const MERGED_DIVIDER_THICKNESS = 1.2;

export type MergeBlockedReason =
  | { readonly kind: 'too-few-bins'; readonly count: number }
  | {
      readonly kind: 'grid-overflow';
      readonly cols: number;
      readonly rows: number;
      readonly max: number;
    }
  | {
      readonly kind: 'too-large';
      readonly width: number;
      readonly depth: number;
      readonly max: number;
    }
  | { readonly kind: 'invalid-params'; readonly code: string; readonly message: string };

export interface MergeWarnings {
  /** Bins whose height was raised to the tallest in the selection. */
  readonly raisedHeightBinIds: readonly BinId[];
  /** Bins linked to a design whose custom geometry the merge cannot carry. */
  readonly linkedDesignBinIds: readonly BinId[];
  /** Compartments created from cells no bin covered. */
  readonly gapCompartmentCount: number;
  /** True when the piece exceeds the print bed and split connectors were enabled. */
  readonly splitEnabled: boolean;
  /**
   * Bins on this layer that were NOT chosen but sit inside the bento's
   * footprint. The piece is built from the bounding box, so their space becomes
   * gap compartments and the printed part would occupy the drawer cells they
   * already stand in. Two parts in one place is not a preference, so the caller
   * must resolve these before committing rather than warn and continue.
   */
  readonly trappedBinIds: readonly BinId[];
}

export interface MergePlan {
  readonly params: BinParams;
  /** False when the selection left gaps inside its bounding box. */
  readonly isRectangular: boolean;
  readonly compartmentCount: number;
  /**
   * Compartment IDs that came from empty space rather than a bin, AFTER
   * `normalizeIds` renumbering — so they index `cells` and `compartmentTexts`
   * directly. Lets the preview draw them apart from the ones the user placed.
   */
  readonly gapCompartmentIds: readonly number[];
  readonly warnings: MergeWarnings;
}

export interface MergeOptions {
  /** `'flat'` produces a socketless drawer insert instead of a Gridfinity base. */
  readonly baseStyle?: 'standard' | 'flat';
  /**
   * Height in units. Defaults to the tallest bin in the selection — the only
   * value that cannot crop what a bin already holds.
   */
  readonly heightUnits?: number;
  /** Divider wall thickness in mm. Defaults to {@link MERGED_DIVIDER_THICKNESS}. */
  readonly dividerThickness?: number;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y > 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

/** Grid units → half-unit integers, so edge arithmetic stays exact. */
function toHalfUnits(v: number): number {
  return Math.round(v * HALF_UNITS_PER_GRID);
}

/**
 * Coarsest uniform cell size (in half-units) that puts every bin edge on a
 * cell boundary. Using the GCD rather than always-half-bin is what keeps a
 * 6-unit drawer of whole bins at 6 columns instead of 12 — the difference
 * between fitting `MAX_COMPARTMENT_GRID` and being rejected by it.
 *
 * BOTH edges of every bin have to be offered, not just its near one: a 1-unit
 * bin sharing an origin with a 3-unit bin contributes only offset 0 on that
 * axis, and the span's GCD alone would collapse the grid to a single column
 * that cannot represent the narrow bin.
 */
function cellSizeHalfUnits(edges: readonly number[]): number {
  return edges.reduce((acc, v) => (v === 0 ? acc : gcd(acc, v)), 0) || 1;
}

/**
 * Decompose the cells no bin covers into maximal rectangles, greedily: extend
 * right along the row, then down while the whole column range stays uncovered.
 *
 * One compartment per empty CELL would also satisfy the "same ID must form a
 * rectangle" invariant, but a 2×2 gap would arrive as four cramped
 * compartments instead of one usable well.
 */
function assignGapRectangles(
  owner: (number | null)[],
  cols: number,
  rows: number,
  nextId: number
): { readonly assigned: (number | null)[]; readonly count: number } {
  const out = [...owner];
  let id = nextId;
  let count = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (out[row * cols + col] !== null) continue;

      let width = 1;
      while (col + width < cols && out[row * cols + col + width] === null) width++;

      let height = 1;
      while (row + height < rows) {
        let rowIsFree = true;
        for (let c = col; c < col + width; c++) {
          if (out[(row + height) * cols + c] !== null) {
            rowIsFree = false;
            break;
          }
        }
        if (!rowIsFree) break;
        height++;
      }

      for (let r = row; r < row + height; r++) {
        for (let c = col; c < col + width; c++) out[r * cols + c] = id;
      }
      id++;
      count++;
    }
  }

  return { assigned: out, count };
}

/**
 * Build the merged design for `bins`, which the caller has already narrowed to
 * a single layer. Returns the plan or the reason the merge cannot proceed.
 */
export function planMergedBin(
  bins: readonly Bin[],
  layout: Layout,
  options: MergeOptions = {}
): Result<MergePlan, MergeBlockedReason> {
  // One bin is not a merge — it would emit a single-compartment copy of that
  // bin. Enforced here rather than only in the UI so no entry point can skip it.
  if (bins.length < 2) return err({ kind: 'too-few-bins', count: bins.length });

  const minX = Math.min(...bins.map((b) => b.x));
  const minY = Math.min(...bins.map((b) => b.y));
  const maxX = Math.max(...bins.map((b) => b.x + b.width));
  const maxY = Math.max(...bins.map((b) => b.y + b.depth));

  const widthUnits = maxX - minX;
  const depthUnits = maxY - minY;

  const spanX = toHalfUnits(widthUnits);
  const spanY = toHalfUnits(depthUnits);
  const cellX = cellSizeHalfUnits([
    ...bins.flatMap((b) => [toHalfUnits(b.x - minX), toHalfUnits(b.x + b.width - minX)]),
    spanX,
  ]);
  const cellY = cellSizeHalfUnits([
    ...bins.flatMap((b) => [toHalfUnits(b.y - minY), toHalfUnits(b.y + b.depth - minY)]),
    spanY,
  ]);

  const cols = spanX / cellX;
  const rows = spanY / cellY;
  const { MAX_COMPARTMENT_GRID, MAX_DIMENSION } = DESIGNER_CONSTRAINTS;

  if (cols > MAX_COMPARTMENT_GRID || rows > MAX_COMPARTMENT_GRID) {
    return err({ kind: 'grid-overflow', cols, rows, max: MAX_COMPARTMENT_GRID });
  }
  if (widthUnits > MAX_DIMENSION || depthUnits > MAX_DIMENSION) {
    return err({
      kind: 'too-large',
      width: widthUnits,
      depth: depthUnits,
      max: MAX_DIMENSION,
    });
  }

  // Row-major with row 0 at the bottom — the CompartmentConfig storage order,
  // which already matches the layout grid's bottom-left origin.
  const owner: (number | null)[] = new Array<number | null>(cols * rows).fill(null);
  const labelByBinIndex: string[] = [];

  bins.forEach((bin, index) => {
    labelByBinIndex[index] = bin.label;
    const colStart = toHalfUnits(bin.x - minX) / cellX;
    const colEnd = toHalfUnits(bin.x + bin.width - minX) / cellX;
    const rowStart = toHalfUnits(bin.y - minY) / cellY;
    const rowEnd = toHalfUnits(bin.y + bin.depth - minY) / cellY;
    for (let row = rowStart; row < rowEnd; row++) {
      for (let col = colStart; col < colEnd; col++) owner[row * cols + col] = index;
    }
  });

  const { assigned, count: gapCompartmentCount } = assignGapRectangles(
    owner,
    cols,
    rows,
    bins.length
  );

  const rawCells = assigned.map((id) => id ?? 0);
  const { cells, remap } = normalizeIdsWithRemap(rawCells);
  // Gap rectangles were numbered from `bins.length` up, before normalization.
  const gapCompartmentIds = [...remap.entries()]
    .filter(([rawId]) => rawId >= bins.length)
    .map(([, newId]) => newId)
    .sort((a, b) => a - b);
  const compartmentTexts = remapCompartmentTexts(labelByBinIndex, remap);
  const hasAnyLabel = compartmentTexts.some((t) => t.length > 0);

  const tallest = Math.max(...bins.map((b) => b.height));
  const heightUnits = options.heightUnits ?? tallest;
  const raisedHeightBinIds = bins.filter((b) => b.height < heightUnits).map((b) => b.id);
  const linkedDesignBinIds = bins.filter((b) => b.linkedDesignId !== undefined).map((b) => b.id);

  // Bins left out of the selection that the piece would nonetheless be built
  // over. Scoped to the layer the selection is on, since bins on other layers
  // sit at a different height in the drawer and do not share this space.
  const chosen = new Set<BinId>(bins.map((b) => b.id));
  const layerId = bins[0].layerId;
  const trappedBinIds = layout.bins
    .filter(
      (b) =>
        b.layerId === layerId &&
        !chosen.has(b.id) &&
        b.x < maxX &&
        b.x + b.width > minX &&
        b.y < maxY &&
        b.y + b.depth > minY
    )
    .map((b) => b.id);

  const gridUnitMm = layout.gridUnitMm;
  const gridUnitMmY = effectiveGridUnitMmY(layout);
  const bedWidth = layout.printBedSize;
  const bedDepth = layout.printBedDepth ?? layout.printBedSize;
  const splitEnabled = widthUnits * gridUnitMm > bedWidth || depthUnits * gridUnitMmY > bedDepth;

  const params: BinParams = {
    ...DEFAULT_BIN_PARAMS,
    width: widthUnits,
    depth: depthUnits,
    height: heightUnits,
    gridUnitMm,
    gridUnitMmY,
    heightUnitMm: layout.heightUnitMm,
    fractionalEdgeX: layout.drawer.fractionalEdgeX ?? DEFAULT_BIN_PARAMS.fractionalEdgeX,
    fractionalEdgeY: layout.drawer.fractionalEdgeY ?? DEFAULT_BIN_PARAMS.fractionalEdgeY,
    base: { ...DEFAULT_BIN_PARAMS.base, style: options.baseStyle ?? 'standard' },
    compartments: {
      cols,
      rows,
      cells,
      thickness: options.dividerThickness ?? MERGED_DIVIDER_THICKNESS,
      ...(hasAnyLabel ? { compartmentTexts } : {}),
    },
    // Tabs exist to carry the labels; without any text they would only add
    // material and shrink every compartment.
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: hasAnyLabel },
    ...(splitEnabled
      ? {
          splitConnectors: {
            ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
            enabled: true,
            wallConnector: 'key' as const,
          },
        }
      : {}),
  };

  const validated = validateBinParams(params);
  if (!isOk(validated)) {
    return err({
      kind: 'invalid-params',
      code: validated.error.code,
      message: validated.error.message,
    });
  }

  return ok({
    params: validated.value,
    isRectangular: gapCompartmentCount === 0,
    compartmentCount: bins.length + gapCompartmentCount,
    gapCompartmentIds,
    warnings: {
      raisedHeightBinIds,
      linkedDesignBinIds,
      gapCompartmentCount,
      splitEnabled,
      trappedBinIds,
    },
  });
}
