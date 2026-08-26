/**
 * Compartment grid utilities.
 *
 * Provides functions for manipulating the grid-based cell ownership model:
 * - Creating uniform grids
 * - Merging/splitting cells
 * - Validating rectangular compartment constraints
 * - Deriving divider wall segments from the cell map
 *
 * ID remapping lives in ./compartmentRemap and label-tab fit in
 * ./compartmentTabFit; both are re-exported below, so this stays the one import
 * path for the compartment model.
 */

/* eslint-disable max-lines -- The grid model and the divider geometry that reads it are one
   mutually recursive unit: override validation, divider eligibility and merge/split all call
   back into the contiguity and bounds rules they sit above. Splitting further would buy line
   count with an import cycle. */

import type { CompartmentConfig, DividerOverride } from '../types';
import {
  normalizeIdsWithRemap,
  remapBackgroundIds,
  remapCompartmentColors,
  remapCompartmentColorScopes,
  remapCompartmentTexts,
  remapDividerOverrides,
  remapDrawnUnitCells,
  remapLabelIcons,
  remapLabelPlateWidths,
} from './compartmentRemap';

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

/**
 * Compartment IDs in visual reading order: top-left first, then left-to-right
 * and top-to-bottom — the order a user's eye scans when labeling.
 *
 * IDs are assigned in data-row order, but the 2D grid renders `flex-col-reverse`
 * so data row 0 is the visual BOTTOM. Numeric `getCompartmentIds` therefore
 * counts up from the bottom-left, which reads backwards. Here we anchor
 * each compartment at its visual top-left cell (highest data row = `maxRow`,
 * then leftmost `minCol`) and sort by that.
 *
 * Display-only: the "Comp. N" numbering on cells, the below-grid field, and the
 * bulk list all consume this so they stay in lockstep. Validation and general
 * iteration keep the cheaper numeric `getCompartmentIds`.
 */
export function getCompartmentReadingOrder(config: CompartmentConfig): number[] {
  const entries = getCompartmentIds(config).map((id) => {
    const bounds = getCompartmentBounds(config, id);
    return { id, top: bounds ? bounds.maxRow : -1, left: bounds ? bounds.minCol : id };
  });
  entries.sort((a, b) => (a.top !== b.top ? b.top - a.top : a.left - b.left));
  return entries.map((e) => e.id);
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
 * Check whether a set of cells is one 4-connected region.
 *
 * The weaker sibling of {@link isRectangularSelection}, and the invariant a
 * compartment actually has to hold: divider walls fall out of the boundaries
 * between differing cell IDs, so any connected blob prints as one pocket. Two
 * disjoint islands under one ID would print as two pockets sharing a label,
 * colour and dock entry, which is why that stays rejected.
 */
export function isContiguousSelection(
  cols: number,
  cellIndices: number[] | readonly number[]
): boolean {
  if (cellIndices.length === 0) return false;
  const remaining = new Set(cellIndices);
  const stack = [cellIndices[0]];
  remaining.delete(cellIndices[0]);
  while (stack.length > 0) {
    const idx = stack.pop() as number;
    const col = idx % cols;
    const neighbours = [
      col > 0 ? idx - 1 : -1,
      col + 1 < cols ? idx + 1 : -1,
      idx - cols,
      idx + cols,
    ];
    for (const n of neighbours) {
      if (n < 0 || !remaining.has(n)) continue;
      remaining.delete(n);
      stack.push(n);
    }
  }
  return remaining.size === 0;
}

/** True when every ID in `cells` occupies one connected region. */
function allCompartmentsContiguous(cols: number, cells: readonly number[]): boolean {
  const byId = new Map<number, number[]>();
  cells.forEach((id, idx) => {
    const list = byId.get(id);
    if (list) list.push(idx);
    else byId.set(id, [idx]);
  });
  for (const indices of byId.values()) {
    if (!isContiguousSelection(cols, indices)) return false;
  }
  return true;
}

/**
 * Whether a stash footprint mask is one the grid can actually take: the right
 * length for its box, at least one filled cell, not every cell (a rectangle has
 * its own encoding, the absent field), and one 4-connected region.
 *
 * Shared by the load-time sanitizer, the placement path and the shelf preview so
 * a mask cannot be dropped by one and honoured by another, which would advertise
 * a shape the drop never produces.
 */
export function isUsableFootprintMask(mask: readonly boolean[], w: number, h: number): boolean {
  if (mask.length !== w * h) return false;
  const filled: number[] = [];
  mask.forEach((cell, i) => {
    if (cell) filled.push(i);
  });
  if (filled.length === 0 || filled.length === mask.length) return false;
  // The mask is its own w-wide grid, so its own width is the stride.
  return isContiguousSelection(w, filled);
}

/**
 * Whether a compartment fills its own bounding box.
 *
 * Non-rectangular compartments (an L, U or S built by merging) are valid
 * geometry — the wall builder only reads ID boundaries — but every feature
 * that positions itself from `getCompartmentBounds` would land in the notch.
 * Those features gate on this.
 */
export function isRectangularCompartment(
  config: CompartmentConfig,
  compartmentId: number
): boolean {
  return isRectangularSelection(config.cols, getCellsForCompartment(config, compartmentId));
}

/**
 * Validate that every compartment in the grid is one connected region.
 * Returns the IDs of any invalid compartments, or empty array if all valid.
 */
export function validateCompartmentGrid(config: CompartmentConfig): number[] {
  const invalid: number[] = [];
  const ids = getCompartmentIds(config);

  for (const id of ids) {
    const cells = getCellsForCompartment(config, id);
    if (!isContiguousSelection(config.cols, cells)) {
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

/** Absolute schema bound. The reachable lean is much smaller and bin-dependent
 *  (see `getDividerGeometry`). */
export const DIVIDER_RAKE_MAX_DEG = 80;

export type DividerOverrideValidationError =
  | 'unordered-pair'
  | 'self-pair'
  | 'unknown-compartment'
  | 'non-adjacent-compartments'
  | 'non-rectangular-compartment'
  | 'offset-not-finite'
  | 'offset-out-of-bounds'
  | 'rake-not-finite'
  | 'rake-out-of-bounds'
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
  const { compartmentA, compartmentB, offsetStart, offsetEnd, rakeDeg } = override;
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
  if (rakeDeg !== undefined) {
    if (!Number.isFinite(rakeDeg)) return 'rake-not-finite';
    if (Math.abs(rakeDeg) > DIVIDER_RAKE_MAX_DEG) return 'rake-out-of-bounds';
  }
  if (!compartmentsAreAdjacent(config, compartmentA, compartmentB)) {
    return 'non-adjacent-compartments';
  }
  if (
    !isRectangularCompartment(config, compartmentA) ||
    !isRectangularCompartment(config, compartmentB)
  ) {
    return 'non-rectangular-compartment';
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
 * One row in the panel's "Diagonal dividers" section: a pair of adjacent
 * compartments whose shared divider segment can be tilted, plus the current
 * override values (zero if no override exists yet) and the axis the segment
 * runs along (so the UI can label endpoints consistently).
 */
export interface EligibleDivider {
  readonly compartmentA: number;
  readonly compartmentB: number;
  /** 'vertical' = compartments stacked horizontally (boundary runs along Y). */
  readonly axis: 'vertical' | 'horizontal';
  readonly offsetStart: number;
  readonly offsetEnd: number;
  /** Lean off vertical in degrees; 0 when the divider stands upright. */
  readonly rakeDeg: number;
}

/**
 * Enumerate every interior divider segment that could carry a tilt override.
 * Mirrors the worker-side wall-segment derivation but at the compartment-pair
 * granularity the panel UI needs — one row per (compartmentA, compartmentB).
 *
 * Order is stable (by axis then by canonical pair) so panel row positions
 * don't shuffle as the user mutates the grid.
 */
export function getEligibleDividers(config: CompartmentConfig): EligibleDivider[] {
  const { cols, rows, cells } = config;
  // Dedup key is canonical-pair-only (no axis) to match the storage model
  // — overrides key on `(compartmentA, compartmentB)` alone. Including
  // axis here would surface duplicate rows for any layout where the same
  // pair appears on both axes (defense-in-depth against future validator
  // gaps that let through non-rectangular configurations).
  const seen = new Set<string>();
  const out: EligibleDivider[] = [];
  const overrideByPair = new Map<string, DividerOverride>();
  for (const o of config.dividerOverrides ?? []) {
    overrideByPair.set(`${o.compartmentA}|${o.compartmentB}`, o);
  }
  const consider = (a: number, b: number, axis: 'vertical' | 'horizontal'): void => {
    if (a === b) return;
    // A non-rectangular compartment can share several disjoint boundary runs
    // with one neighbour, and an override names a pair, not a run — there is
    // no single segment to tilt.
    if (!isRectangularCompartment(config, a) || !isRectangularCompartment(config, b)) return;
    const [ca, cb] = a < b ? [a, b] : [b, a];
    const key = `${ca}|${cb}`;
    if (seen.has(key)) return;
    seen.add(key);
    const existing = overrideByPair.get(key);
    out.push({
      compartmentA: ca,
      compartmentB: cb,
      axis,
      offsetStart: existing?.offsetStart ?? 0,
      offsetEnd: existing?.offsetEnd ?? 0,
      rakeDeg: existing?.rakeDeg ?? 0,
    });
  };
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = cells[row * cols + col];
      if (col + 1 < cols) consider(id, cells[row * cols + (col + 1)], 'vertical');
      if (row + 1 < rows) consider(id, cells[(row + 1) * cols + col], 'horizontal');
    }
  }
  // Stable sort to match the JSDoc contract: vertical dividers first, then
  // horizontal, with canonical-pair ordering inside each group. Grid-scan
  // order is mostly equivalent but not guaranteed (interleaves axes).
  out.sort((p, q) => {
    if (p.axis !== q.axis) return p.axis === 'vertical' ? -1 : 1;
    if (p.compartmentA !== q.compartmentA) return p.compartmentA - q.compartmentA;
    return p.compartmentB - q.compartmentB;
  });
  return out;
}

/** Canonical-pair key for an override lookup map. */
export function overrideKey(a: number, b: number): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * How far a leaning divider's foot travels from its top edge, signed like the
 * endpoint offsets. The one statement of this conversion: the wall builder,
 * the viability guard, the rail plan, the offset envelope, the canvas overlay
 * and the panel readout all read it rather than restate it.
 */
export function dividerFootDrift(
  override: { readonly rakeDeg?: number } | undefined,
  dividerHeight: number
): number {
  const rake = override?.rakeDeg ?? 0;
  if (rake === 0 || dividerHeight <= 0) return 0;
  return dividerHeight * Math.tan((rake * Math.PI) / 180);
}

export function hasDividerLean(config: {
  readonly dividerOverrides?: readonly DividerOverride[];
}): boolean {
  return (config.dividerOverrides ?? []).some((o) => (o.rakeDeg ?? 0) !== 0);
}

export function buildOverrideLookup(
  overrides: readonly DividerOverride[] | undefined
): Map<string, DividerOverride> {
  const lookup = new Map<string, DividerOverride>();
  if (!overrides) return lookup;
  for (const o of overrides) {
    lookup.set(overrideKey(o.compartmentA, o.compartmentB), o);
  }
  return lookup;
}

/**
 * Walk a boundary line in single-cell steps and group contiguous cells where
 * `key(i)` returns the SAME non-null string into runs. Each emitted run has
 * a uniform `pairKey`. Used so the override lookup applies to runs that
 * actually correspond to one (compartmentA, compartmentB) pair — a longer
 * fused run that crosses pair changes would silently apply the first pair's
 * override to the entire wall.
 *
 * Lives here rather than beside the wall builder because the lid's click rails
 * have to notch around the same runs and the main thread cannot import
 * a module that pulls in brepjs.
 */
export function findPairAwareRuns(
  count: number,
  key: (i: number) => string | null
): Array<{ start: number; end: number; pairKey: string }> {
  const runs: Array<{ start: number; end: number; pairKey: string }> = [];
  // Carry start + key as a single nullable object so segStart and segKey can
  // never disagree (one set, the other still null). Prior shape stored them
  // separately and TypeScript couldn't prove the invariant; reviewers
  // flagged the `segKey ?? ''` fallback as either dead code or a silent
  // misroute waiting to happen.
  let open: { start: number; key: string } | null = null;
  for (let i = 0; i < count; i++) {
    const k = key(i);
    if (k === null) {
      if (open !== null) {
        runs.push({ start: open.start, end: i, pairKey: open.key });
        open = null;
      }
    } else if (open === null) {
      open = { start: i, key: k };
    } else if (k !== open.key) {
      runs.push({ start: open.start, end: i, pairKey: open.key });
      open = { start: i, key: k };
    }
  }
  if (open !== null) {
    runs.push({ start: open.start, end: count, pairKey: open.key });
  }
  return runs;
}

/**
 * True when an axis-aligned rectangle (e.g. a floor insert's footprint)
 * straddles ANY tilted divider segment. Used by `buildInsertCuts` to skip
 * inserts that would otherwise cross from one wedge compartment into
 * another — the resulting cavity would punch through a tilted wall and
 * produce visually broken geometry.
 *
 * The check is conservative: it considers each tilted divider's segment
 * as an infinite line for the cross test (rather than just the segment),
 * which over-rejects for inserts placed near the end of a segment but
 * far past its endpoints. That's the right safety vs. flexibility
 * trade-off for v1 — false positives only suppress, never produce broken
 * geometry.
 *
 * Rectangle coords are interior-frame mm (origin at bin center).
 */
export function rectStraddlesTiltedDivider(
  config: CompartmentConfig,
  innerW: number,
  innerD: number,
  rect: { x: number; y: number; width: number; depth: number }
): boolean {
  const overrides = config.dividerOverrides;
  if (!overrides || overrides.length === 0) return false;
  const corners: ReadonlyArray<readonly [number, number]> = [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x + rect.width, rect.y + rect.depth],
    [rect.x, rect.y + rect.depth],
  ];
  const { cols, rows, cells } = config;
  for (const o of overrides) {
    // Skip overrides where the offset is zero on both ends (no tilt).
    if (o.offsetStart === 0 && o.offsetEnd === 0) continue;
    const endpoints = tiltedDividerEndpoints(o, cols, rows, cells, innerW, innerD);
    if (!endpoints) continue;
    const { p1, p2 } = endpoints;
    // Implicit form of the line through p1 → p2: (x - p1.x) * (p2.y -
    // p1.y) - (y - p1.y) * (p2.x - p1.x). Positive on one side, negative
    // on the other. If any two corners produce opposite signs the
    // rectangle straddles the line.
    let sawPositive = false;
    let sawNegative = false;
    for (const [cx, cy] of corners) {
      const s = (cx - p1.x) * (p2.y - p1.y) - (cy - p1.y) * (p2.x - p1.x);
      if (s > 0) sawPositive = true;
      else if (s < 0) sawNegative = true;
      if (sawPositive && sawNegative) return true;
    }
  }
  return false;
}

/**
 * World-frame endpoints (mm, origin at bin center) of a tilted divider.
 * Returns null when the override doesn't correspond to an interior cell
 * boundary (e.g. after a non-adjacent remap — defense-in-depth).
 */
function tiltedDividerEndpoints(
  override: DividerOverride,
  cols: number,
  rows: number,
  cells: number[],
  innerW: number,
  innerD: number
): { p1: { x: number; y: number }; p2: { x: number; y: number } } | null {
  // Vertical divider: find the contiguous run of rows where the pair
  // (left=a, right=b) or (left=b, right=a) holds at the same col
  // boundary. The worker's `findPairAwareRuns` derives segment endpoints
  // from that run, NOT from the bin walls — so partial-span dividers
  // (e.g. a 2×2 where override applies to only the top half of a column
  // boundary) need the segment's true row-range, not the full bin depth.
  // Greptile flagged the bug on: full-span endpoints can make
  // `rectStraddlesTiltedDivider` miss inserts that actually cross a
  // partial-span tilted segment.
  for (let col = 0; col < cols - 1; col++) {
    let runStart: number | null = null;
    let runEnd: number | null = null;
    for (let row = 0; row < rows; row++) {
      const left = cells[row * cols + col];
      const right = cells[row * cols + (col + 1)];
      const [a, b] = left < right ? [left, right] : [right, left];
      const matches = a === override.compartmentA && b === override.compartmentB;
      if (matches && runStart === null) runStart = row;
      if (matches) runEnd = row + 1;
      else if (runStart !== null) break; // run ended; non-contiguous would be invalid
    }
    if (runStart !== null && runEnd !== null) {
      const xMm = -innerW / 2 + ((col + 1) / cols) * innerW;
      const cellD = innerD / rows;
      const yStart = -innerD / 2 + runStart * cellD;
      const yEnd = -innerD / 2 + runEnd * cellD;
      return {
        p1: { x: xMm + override.offsetStart, y: yStart },
        p2: { x: xMm + override.offsetEnd, y: yEnd },
      };
    }
  }
  // Horizontal divider: symmetric — partial-span across a column range.
  for (let row = 0; row < rows - 1; row++) {
    let runStart: number | null = null;
    let runEnd: number | null = null;
    for (let col = 0; col < cols; col++) {
      const top = cells[row * cols + col];
      const bottom = cells[(row + 1) * cols + col];
      const [a, b] = top < bottom ? [top, bottom] : [bottom, top];
      const matches = a === override.compartmentA && b === override.compartmentB;
      if (matches && runStart === null) runStart = col;
      if (matches) runEnd = col + 1;
      else if (runStart !== null) break;
    }
    if (runStart !== null && runEnd !== null) {
      const yMm = -innerD / 2 + ((row + 1) / rows) * innerD;
      const cellW = innerW / cols;
      const xStart = -innerW / 2 + runStart * cellW;
      const xEnd = -innerW / 2 + runEnd * cellW;
      return {
        p1: { x: xStart, y: yMm + override.offsetStart },
        p2: { x: xEnd, y: yMm + override.offsetEnd },
      };
    }
  }
  return null;
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

// Label Tab Span / Eligibility

export {
  compartmentHasTiltedBackWall,
  compartmentHasTiltedFrontWall,
  compartmentTabEligible,
  compartmentTabXSpan,
  dividerShift,
  rowHasFullWidthWall,
  spanRegionDepth,
  spanningTabEligible,
} from './compartmentTabFit';
export type { CompartmentTabSpan, LabelTabFit, TabAnchorSide } from './compartmentTabFit';

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
 * The cells must form one connected region; returns null if they don't.
 * Uses the lowest existing compartment ID from the merged cells, or
 * assigns the next available ID.
 */
export function mergeCells(
  config: CompartmentConfig,
  cellIndices: number[] | readonly number[]
): CompartmentConfig | null {
  if (!isContiguousSelection(config.cols, cellIndices)) return null;

  // Find the target compartment ID (lowest existing in selection)
  const existingIds = cellIndices.map((i) => config.cells[i]);
  const targetId = Math.min(...existingIds);

  const newCells = [...config.cells];
  for (const idx of cellIndices) {
    newCells[idx] = targetId;
  }

  // Taking part of a compartment can strand the rest in two pieces. The
  // selection being connected says nothing about what it leaves behind.
  if (!allCompartmentsContiguous(config.cols, newCells)) return null;

  const { cells: normalized, remap } = normalizeIdsWithRemap(newCells);
  return {
    ...config,
    cells: normalized,
    ...(config.compartmentTexts && {
      compartmentTexts: remapCompartmentTexts(config.compartmentTexts, remap),
    }),
    ...(config.labelPlateWidths && {
      labelPlateWidths: remapLabelPlateWidths(config.labelPlateWidths, remap),
    }),
    ...(config.labelIcons && {
      labelIcons: remapLabelIcons(config.labelIcons, remap),
    }),
    ...(config.compartmentColors && {
      compartmentColors: remapCompartmentColors(config.compartmentColors, remap),
    }),
    ...(config.compartmentColorScopes && {
      compartmentColorScopes: remapCompartmentColorScopes(config.compartmentColorScopes, remap),
    }),
    ...(config.dividerOverrides && {
      dividerOverrides: remapDividerOverrides(config.dividerOverrides, remap),
    }),
    ...(config.drawnUnitCells && {
      drawnUnitCells: remapDrawnUnitCells(config.drawnUnitCells, remap, normalized),
    }),
    ...(config.backgroundIds && {
      backgroundIds: remapBackgroundIds(config.backgroundIds, remap),
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
    ...(config.labelPlateWidths && {
      labelPlateWidths: remapLabelPlateWidths(config.labelPlateWidths, remap),
    }),
    ...(config.labelIcons && {
      labelIcons: remapLabelIcons(config.labelIcons, remap),
    }),
    ...(config.compartmentColors && {
      compartmentColors: remapCompartmentColors(config.compartmentColors, remap),
    }),
    ...(config.compartmentColorScopes && {
      compartmentColorScopes: remapCompartmentColorScopes(config.compartmentColorScopes, remap),
    }),
    ...(config.dividerOverrides && {
      dividerOverrides: remapDividerOverrides(config.dividerOverrides, remap),
    }),
    ...(config.drawnUnitCells && {
      drawnUnitCells: remapDrawnUnitCells(config.drawnUnitCells, remap, normalized),
    }),
    ...(config.backgroundIds && {
      backgroundIds: remapBackgroundIds(config.backgroundIds, remap),
    }),
  };
}

/**
 * Cells-only preview of a merge: assign every selected cell to the first
 * selection's compartment ID. Returns a fresh array.
 *
 * Deliberately skips ID normalization and the parallel-array remap that the
 * committed {@link mergeCells} performs — a drag ghost only needs the cell
 * partition to derive divider walls, and normalizing the preview would renumber
 * IDs the committed result hasn't yet applied.
 */
export function previewMergeCells(
  cells: readonly number[],
  cellIndices: readonly number[]
): number[] {
  const next = [...cells];
  if (cellIndices.length === 0) return next;
  const targetId = cells[cellIndices[0]];
  for (const idx of cellIndices) {
    next[idx] = targetId;
  }
  return next;
}

/**
 * Cells-only preview of a split: give each selected cell a fresh unique ID,
 * counting up from the current maximum in the order the indices are supplied.
 * Leaves unselected cells untouched. Returns a fresh array.
 *
 * Like {@link previewMergeCells}, this skips normalization and parallel-array
 * remap — those belong to the commit path. Callers that need a canonical grid
 * (e.g. a committed split) wrap the result in {@link normalizeIds}.
 */
export function previewSplitCells(
  cells: readonly number[],
  cellIndices: readonly number[]
): number[] {
  const next = [...cells];
  let nextId = Math.max(...cells) + 1;
  for (const idx of cellIndices) {
    next[idx] = nextId++;
  }
  return next;
}

// ID Remapping

export {
  carryCompartmentTextsByPosition,
  normalizeIds,
  normalizeIdsWithRemap,
  remapBackgroundIds,
  remapCompartmentColors,
  remapCompartmentColorScopes,
  remapCompartmentTexts,
  remapDividerOverrides,
  remapDrawnUnitCells,
  remapLabelIcons,
  remapLabelPlateWidths,
} from './compartmentRemap';

// Wall Segment Derivation

// Wall-segment geometry lives in shared/ so the generation worker can derive
// walls without importing across feature boundaries. Re-exported here for the
// existing bin-designer consumers; CompartmentConfig satisfies CompartmentGrid.
export {
  deriveWallSegments,
  type WallSegment,
  type CompartmentGrid,
} from '@/shared/utils/compartmentGeometry';

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
