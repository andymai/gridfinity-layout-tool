/**
 * Compartment grid utilities.
 *
 * Provides functions for manipulating the grid-based cell ownership model:
 * - Creating uniform grids
 * - Merging/splitting cells
 * - Validating rectangular compartment constraints
 * - Deriving divider wall segments from the cell map
 */

import type { CompartmentConfig, DividerOverride } from '../types';

// Grid Creation

/**
 * Create a uniform compartment grid where each cell is its own compartment.
 * This is the equivalent of the old dividers system with (cols-1) x dividers
 * and (rows-1) y dividers.
 */
export function createUniformGrid(
  cols: number,
  rows: number,
  thickness: number
): CompartmentConfig {
  const cells: number[] = [];
  for (let i = 0; i < rows * cols; i++) {
    cells.push(i);
  }
  return { cols, rows, thickness, cells };
}

/**
 * Create a single-cell grid (no compartments / no dividers).
 */
export function createSingleCell(thickness: number): CompartmentConfig {
  return { cols: 1, rows: 1, thickness, cells: [0] };
}

// Cell Access Helpers

/** Get the compartment ID for a cell at (col, row) */
export function getCellId(config: CompartmentConfig, col: number, row: number): number {
  return config.cells[row * config.cols + col];
}

/** Get the flat index for a cell at (col, row) */
export function cellIndex(cols: number, col: number, row: number): number {
  return row * cols + col;
}

// Compartment Queries

/** Get all unique compartment IDs in the grid */
export function getCompartmentIds(config: CompartmentConfig): number[] {
  return [...new Set(config.cells)].sort((a, b) => a - b);
}

/** Get all cell indices belonging to a compartment */
export function getCellsForCompartment(config: CompartmentConfig, compartmentId: number): number[] {
  const indices: number[] = [];
  for (let i = 0; i < config.cells.length; i++) {
    if (config.cells[i] === compartmentId) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Get the bounding rectangle of a compartment in grid coordinates.
 * Returns { minCol, maxCol, minRow, maxRow } (inclusive).
 */
export function getCompartmentBounds(
  config: CompartmentConfig,
  compartmentId: number
): { minCol: number; maxCol: number; minRow: number; maxRow: number } | null {
  let minCol = config.cols;
  let maxCol = -1;
  let minRow = config.rows;
  let maxRow = -1;

  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      if (getCellId(config, col, row) === compartmentId) {
        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
      }
    }
  }

  if (maxCol === -1) return null;
  return { minCol, maxCol, minRow, maxRow };
}

/** Get the number of distinct compartments */
export function getCompartmentCount(config: CompartmentConfig): number {
  return new Set(config.cells).size;
}

// Validation

/**
 * Check whether a set of cells forms a valid rectangle.
 * All cells must be contiguous and fill a rectangular region.
 */
export function isRectangularSelection(
  cols: number,
  cellIndices: number[] | readonly number[]
): boolean {
  if (cellIndices.length === 0) return false;
  if (cellIndices.length === 1) return true;

  // Compute bounding box
  let minCol = Infinity;
  let maxCol = -Infinity;
  let minRow = Infinity;
  let maxRow = -Infinity;

  for (const idx of cellIndices) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
  }

  // The selection must fill the entire bounding box
  const expectedCount = (maxCol - minCol + 1) * (maxRow - minRow + 1);
  if (cellIndices.length !== expectedCount) return false;

  // Verify all cells in the bounding box are in the selection
  const indexSet = new Set(cellIndices);
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (!indexSet.has(row * cols + col)) return false;
    }
  }

  return true;
}

/**
 * Validate that all compartments in the grid form valid rectangles.
 * Returns the IDs of any invalid compartments, or empty array if all valid.
 */
export function validateCompartmentGrid(config: CompartmentConfig): number[] {
  const invalid: number[] = [];
  const ids = getCompartmentIds(config);

  for (const id of ids) {
    const cells = getCellsForCompartment(config, id);
    if (!isRectangularSelection(config.cols, cells)) {
      invalid.push(id);
    }
  }

  return invalid;
}

// Divider Override Validation

/** Maximum absolute offset in mm for a single divider endpoint. Generous —
 *  the worker will additionally clip the divider to the bin interior at
 *  generation time, but this stops absurd inputs before they hit storage. */
export const DIVIDER_OFFSET_MAX_MM = 200;

export type DividerOverrideValidationError =
  | 'unordered-pair'
  | 'self-pair'
  | 'unknown-compartment'
  | 'non-adjacent-compartments'
  | 'offset-not-finite'
  | 'offset-out-of-bounds'
  | 'duplicate-pair';

/**
 * Structural validation for a single `DividerOverride` against a compartment
 * config. Returns `null` if valid, or an error code suitable for displaying
 * a tooltip / rejecting a store mutation.
 *
 * Geometric viability (min compartment area, clearance to other dividers,
 * convexity of resulting wedges) is validated separately at drag-commit
 * time and at generation time — the helpers here are structural only so
 * the validator stays cheap to call from anywhere.
 */
export function validateDividerOverride(
  config: CompartmentConfig,
  override: DividerOverride
): DividerOverrideValidationError | null {
  const { compartmentA, compartmentB, offsetStart, offsetEnd } = override;
  if (compartmentA === compartmentB) return 'self-pair';
  if (compartmentA >= compartmentB) return 'unordered-pair';
  const ids = new Set(config.cells);
  if (!ids.has(compartmentA) || !ids.has(compartmentB)) return 'unknown-compartment';
  if (!Number.isFinite(offsetStart) || !Number.isFinite(offsetEnd)) return 'offset-not-finite';
  if (
    Math.abs(offsetStart) > DIVIDER_OFFSET_MAX_MM ||
    Math.abs(offsetEnd) > DIVIDER_OFFSET_MAX_MM
  ) {
    return 'offset-out-of-bounds';
  }
  if (!compartmentsAreAdjacent(config, compartmentA, compartmentB)) {
    return 'non-adjacent-compartments';
  }
  return null;
}

/**
 * Validate a full list of overrides. Catches duplicates (same pair appearing
 * twice) in addition to per-entry structural checks.
 */
export function validateDividerOverrides(
  config: CompartmentConfig,
  overrides: readonly DividerOverride[]
): { ok: true } | { ok: false; index: number; error: DividerOverrideValidationError } {
  const seen = new Set<string>();
  for (let i = 0; i < overrides.length; i++) {
    const o = overrides[i];
    const err = validateDividerOverride(config, o);
    if (err) return { ok: false, index: i, error: err };
    const key = `${o.compartmentA}|${o.compartmentB}`;
    if (seen.has(key)) return { ok: false, index: i, error: 'duplicate-pair' };
    seen.add(key);
  }
  return { ok: true };
}

/**
 * True when the compartment has at least one tilted boundary (i.e. is one
 * end of a `DividerOverride`). Used by features that can't render against
 * non-axis-aligned edges (scoops, label tabs on the tilted side).
 */
export function compartmentHasTiltedEdge(
  config: CompartmentConfig,
  compartmentId: number
): boolean {
  const overrides = config.dividerOverrides;
  if (!overrides || overrides.length === 0) return false;
  for (const o of overrides) {
    if (o.compartmentA === compartmentId || o.compartmentB === compartmentId) return true;
  }
  return false;
}

/**
 * True when the compartment's BACK wall is a tilted divider. Used by label
 * tabs which attach to the back wall and can't currently render on a tilt.
 *
 * "Back" = the +Y direction in interior coords (the higher-row neighbor in
 * the cell grid). A back wall is tilted when the compartment has a back
 * neighbor (not touching the bin's actual back wall) AND a divider override
 * pairs the two compartments.
 */
export function compartmentHasTiltedBackWall(
  config: CompartmentConfig,
  compartmentId: number
): boolean {
  const overrides = config.dividerOverrides;
  if (!overrides || overrides.length === 0) return false;
  const bounds = getCompartmentBounds(config, compartmentId);
  if (!bounds) return false;
  if (bounds.maxRow === config.rows - 1) return false;
  const backRow = bounds.maxRow + 1;
  // Scan the entire back edge from minCol..maxCol. A wide compartment can
  // border multiple different back-neighbors; any of them being tilted-pair
  // with this compartment counts as a tilted back wall.
  const overrideKeys = new Set<string>();
  for (const o of overrides) {
    const a = Math.min(o.compartmentA, o.compartmentB);
    const b = Math.max(o.compartmentA, o.compartmentB);
    overrideKeys.add(`${a}|${b}`);
  }
  for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
    const neighborId = config.cells[backRow * config.cols + col];
    if (neighborId === compartmentId) continue;
    const a = Math.min(compartmentId, neighborId);
    const b = Math.max(compartmentId, neighborId);
    if (overrideKeys.has(`${a}|${b}`)) return true;
  }
  return false;
}

/**
 * True when two compartments share at least one cell-boundary edge. With the
 * existing rectangle constraint, that boundary is automatically contiguous;
 * no further "single segment" check is needed in practice.
 */
function compartmentsAreAdjacent(config: CompartmentConfig, a: number, b: number): boolean {
  const { cols, rows, cells } = config;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = cells[row * cols + col];
      if (id !== a && id !== b) continue;
      // Check right neighbor
      if (col + 1 < cols) {
        const r = cells[row * cols + (col + 1)];
        if ((id === a && r === b) || (id === b && r === a)) return true;
      }
      // Check bottom neighbor
      if (row + 1 < rows) {
        const d = cells[(row + 1) * cols + col];
        if ((id === a && d === b) || (id === b && d === a)) return true;
      }
    }
  }
  return false;
}

// Merge / Split Operations

/**
 * Merge a set of cells into a single compartment.
 * The cells must form a valid rectangle. Returns null if invalid.
 * Uses the lowest existing compartment ID from the merged cells, or
 * assigns the next available ID.
 */
export function mergeCells(
  config: CompartmentConfig,
  cellIndices: number[] | readonly number[]
): CompartmentConfig | null {
  if (!isRectangularSelection(config.cols, cellIndices)) return null;

  // Find the target compartment ID (lowest existing in selection)
  const existingIds = cellIndices.map((i) => config.cells[i]);
  const targetId = Math.min(...existingIds);

  const newCells = [...config.cells];
  for (const idx of cellIndices) {
    newCells[idx] = targetId;
  }

  const { cells: normalized, remap } = normalizeIdsWithRemap(newCells);
  return {
    ...config,
    cells: normalized,
    ...(config.compartmentTexts && {
      compartmentTexts: remapCompartmentTexts(config.compartmentTexts, remap),
    }),
    ...(config.dividerOverrides && {
      dividerOverrides: remapDividerOverrides(config.dividerOverrides, remap),
    }),
  };
}

/**
 * Split a compartment back into individual cells.
 * Each cell in the compartment gets its own unique ID.
 */
export function splitCompartment(
  config: CompartmentConfig,
  compartmentId: number
): CompartmentConfig {
  const newCells = [...config.cells];
  let nextId = Math.max(...newCells) + 1;

  let first = true;
  for (let i = 0; i < newCells.length; i++) {
    if (newCells[i] === compartmentId) {
      if (first) {
        // Keep the first cell with the original ID
        first = false;
      } else {
        newCells[i] = nextId++;
      }
    }
  }

  const { cells: normalized, remap } = normalizeIdsWithRemap(newCells);
  return {
    ...config,
    cells: normalized,
    ...(config.compartmentTexts && {
      compartmentTexts: remapCompartmentTexts(config.compartmentTexts, remap),
    }),
    ...(config.dividerOverrides && {
      dividerOverrides: remapDividerOverrides(config.dividerOverrides, remap),
    }),
  };
}

/**
 * Normalize compartment IDs to be contiguous starting from 0.
 * Preserves spatial ordering (top-left to bottom-right first occurrence).
 */
export function normalizeIds(cells: number[]): number[] {
  return normalizeIdsWithRemap(cells).cells;
}

/**
 * Variant of `normalizeIds` that also returns the `oldId → newId` remap so
 * callers can keep parallel per-compartment arrays (e.g. `compartmentTexts`)
 * in lockstep with `cells`. Use this for any mutation that may renumber IDs.
 */
export function normalizeIdsWithRemap(cells: number[]): {
  cells: number[];
  remap: Map<number, number>;
} {
  const remap = new Map<number, number>();
  let nextId = 0;

  const normalized = cells.map((id) => {
    let normalizedId = remap.get(id);
    if (normalizedId === undefined) {
      normalizedId = nextId++;
      remap.set(id, normalizedId);
    }
    return normalizedId;
  });

  return { cells: normalized, remap };
}

/**
 * Reindex a parallel per-compartment texts array through an `oldId → newId`
 * map (from `normalizeIdsWithRemap`).
 *
 * The remap is always one-to-one — IDs that disappeared from `cells` before
 * normalize ran (e.g. a merge stomped `1,2 → 0`) are absent from the remap
 * and their text drops. New IDs not in `oldTexts` (e.g. from a split) get
 * an empty string in the output slot.
 */
export function remapCompartmentTexts(
  oldTexts: readonly string[] | undefined,
  remap: ReadonlyMap<number, number>
): string[] {
  if (!oldTexts || oldTexts.length === 0) return [];
  let maxNewId = -1;
  for (const newId of remap.values()) {
    if (newId > maxNewId) maxNewId = newId;
  }
  const out: string[] = new Array<string>(maxNewId + 1).fill('');
  for (const [oldId, newId] of remap) {
    const t = oldTexts[oldId];
    if (typeof t === 'string') out[newId] = t;
  }
  return out;
}

/**
 * Reindex divider overrides through an `oldId → newId` remap.
 *
 * Drops any override whose endpoint compartment disappeared (cells stomped
 * before normalize ran) OR whose two endpoints collapsed to the same ID
 * (their boundary no longer exists). Surviving overrides keep canonical
 * `compartmentA < compartmentB` ordering.
 */
export function remapDividerOverrides(
  oldOverrides: readonly DividerOverride[] | undefined,
  remap: ReadonlyMap<number, number>
): DividerOverride[] {
  if (!oldOverrides || oldOverrides.length === 0) return [];
  const out: DividerOverride[] = [];
  // Deduplicate by canonical pair: a merge can collapse two old overrides
  // onto the same new (compartmentA, compartmentB) pair. Keep the first
  // occurrence — without this, the worker's lookup map silently last-write-
  // wins, the validator rejects the design on next save, and the schema's
  // "no duplicate pairs" invariant breaks.
  const seenPairs = new Set<string>();
  for (const o of oldOverrides) {
    const newA = remap.get(o.compartmentA);
    const newB = remap.get(o.compartmentB);
    if (newA === undefined || newB === undefined) continue;
    if (newA === newB) continue;
    const [a, b] = newA < newB ? [newA, newB] : [newB, newA];
    const key = `${a}|${b}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    out.push({
      compartmentA: a,
      compartmentB: b,
      offsetStart: o.offsetStart,
      offsetEnd: o.offsetEnd,
    });
  }
  return out;
}

// Wall Segment Derivation

/** A horizontal or vertical wall segment in bin-interior coordinates (mm) */
export interface WallSegment {
  /** Start X position in mm from bin interior left edge */
  readonly x: number;
  /** Start Y position in mm from bin interior front edge */
  readonly y: number;
  /** Length in mm */
  readonly length: number;
  /** Wall orientation */
  readonly orientation: 'horizontal' | 'vertical';
}

/**
 * Derive divider wall segments from the compartment grid.
 *
 * Scans adjacent cells and places wall segments at boundaries where
 * neighboring cells have different compartment IDs. Merges consecutive
 * segments along the same grid line into longer walls.
 *
 * @param config - The compartment configuration
 * @param innerW - Interior width of the bin in mm
 * @param innerD - Interior depth of the bin in mm
 * @returns Array of wall segments with positions in mm
 */
export function deriveWallSegments(
  config: CompartmentConfig,
  innerW: number,
  innerD: number
): WallSegment[] {
  const { cols, rows } = config;
  if (cols <= 1 && rows <= 1) return [];

  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const segments: WallSegment[] = [];

  // Vertical walls: scan each column boundary (between col i and col i+1)
  for (let colBoundary = 1; colBoundary < cols; colBoundary++) {
    const x = colBoundary * cellW;
    // Find consecutive runs of boundaries (rows where left != right)
    let segStart: number | null = null;

    for (let row = 0; row < rows; row++) {
      const leftId = getCellId(config, colBoundary - 1, row);
      const rightId = getCellId(config, colBoundary, row);

      if (leftId !== rightId) {
        if (segStart === null) segStart = row;
      } else {
        if (segStart !== null) {
          segments.push({
            x,
            y: segStart * cellD,
            length: (row - segStart) * cellD,
            orientation: 'vertical',
          });
          segStart = null;
        }
      }
    }
    // Close any trailing segment
    if (segStart !== null) {
      segments.push({
        x,
        y: segStart * cellD,
        length: (rows - segStart) * cellD,
        orientation: 'vertical',
      });
    }
  }

  // Horizontal walls: scan each row boundary (between row i and row i+1)
  for (let rowBoundary = 1; rowBoundary < rows; rowBoundary++) {
    const y = rowBoundary * cellD;
    let segStart: number | null = null;

    for (let col = 0; col < cols; col++) {
      const topId = getCellId(config, col, rowBoundary - 1);
      const bottomId = getCellId(config, col, rowBoundary);

      if (topId !== bottomId) {
        if (segStart === null) segStart = col;
      } else {
        if (segStart !== null) {
          segments.push({
            x: segStart * cellW,
            y,
            length: (col - segStart) * cellW,
            orientation: 'horizontal',
          });
          segStart = null;
        }
      }
    }
    if (segStart !== null) {
      segments.push({
        x: segStart * cellW,
        y,
        length: (cols - segStart) * cellW,
        orientation: 'horizontal',
      });
    }
  }

  return segments;
}

// Migration from Legacy DividerConfig

/**
 * Convert a legacy DividerConfig (uniform X×Y grid) to CompartmentConfig.
 * A divider config with x=2, y=1 becomes a 3×2 uniform grid.
 */
export function fromDividerConfig(dividers: {
  x: number;
  y: number;
  thickness: number;
}): CompartmentConfig {
  const cols = dividers.x + 1;
  const rows = dividers.y + 1;
  return createUniformGrid(cols, rows, dividers.thickness);
}
