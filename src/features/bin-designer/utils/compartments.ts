/**
 * Compartment grid utilities.
 *
 * Provides functions for manipulating the grid-based cell ownership model:
 * - Creating uniform grids
 * - Merging/splitting cells
 * - Validating rectangular compartment constraints
 * - Deriving divider wall segments from the cell map
 */

/* eslint-disable max-lines -- Cohesive compartment-grid algorithms (grid build, merge/split,
   id renumbering, divider derivation) are tightly coupled: normalizeIds() renumbers cell IDs on
   every merge/split, so the derivation here and any parallel arrays must stay in lockstep
   (CLAUDE.md gotcha #6). Splitting these print-critical paths for a soft line-count limit risks
   regressions; kept together deliberately. */

import type { CompartmentColorScope, CompartmentConfig, DividerOverride } from '../types';

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

/** Absolute schema bound. The reachable lean is much smaller and bin-dependent
 *  (see `getDividerGeometry`). */
export const DIVIDER_RAKE_MAX_DEG = 80;

export type DividerOverrideValidationError =
  | 'unordered-pair'
  | 'self-pair'
  | 'unknown-compartment'
  | 'non-adjacent-compartments'
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
  override: DividerOverride | undefined,
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

/** Which wall of a row a label tab hangs from. */
export type TabAnchorSide = 'back' | 'front';

/** A compartment's usable X extent (mm, interior frame, origin at bin centre). */
export interface CompartmentTabSpan {
  readonly left: number;
  readonly right: number;
}

/**
 * Signed mm shift of one vertical boundary of `compartmentId`, resolved from
 * `dividerOverrides`.
 *
 * `side` names which boundary of the compartment this is, and therefore which
 * endpoint of a TILTED divider bounds an axis-aligned tab: the left boundary is
 * bounded by its rightmost endpoint, the right boundary by its leftmost. A
 * straight shift has both endpoints equal, so the choice is moot there.
 *
 * A tall compartment can border different neighbours per row, each with its own
 * override, so every bordering row is folded in: the tab is one rectangle and
 * has to clear all of them.
 */
/**
 * How far a compartment's edge has been pushed off its grid line by
 * `dividerOverrides`, in mm.
 *
 * The two axes are the same problem with rows and columns swapped: a positive
 * offset moves a vertical divider toward +X and a horizontal one toward +Y, so
 * the near side ('left'/'bottom') takes the most-positive offset and the far
 * side ('right'/'top') the most-negative. Taking the extreme is deliberate —
 * a tilted wall has two different endpoint offsets, and the compartment's
 * usable extent is bounded by whichever end intrudes furthest.
 */
export function dividerShift(
  config: CompartmentConfig,
  compartmentId: number,
  bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number },
  side: 'left' | 'right' | 'bottom' | 'top'
): number {
  const overrides = config.dividerOverrides;
  if (!overrides || overrides.length === 0) return 0;
  const { cols, rows, cells } = config;
  const isX = side === 'left' || side === 'right';
  const isNear = side === 'left' || side === 'bottom';

  const neighborIndex = isX
    ? isNear
      ? bounds.minCol - 1
      : bounds.maxCol + 1
    : isNear
      ? bounds.minRow - 1
      : bounds.maxRow + 1;
  const limit = isX ? cols : rows;
  if (neighborIndex < 0 || neighborIndex >= limit) return 0;

  const spanStart = isX ? bounds.minRow : bounds.minCol;
  const spanEnd = isX ? bounds.maxRow : bounds.maxCol;

  let shift = isNear ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  for (let i = spanStart; i <= spanEnd; i++) {
    const neighborId = isX ? cells[i * cols + neighborIndex] : cells[neighborIndex * cols + i];
    if (neighborId === compartmentId) continue;
    const a = Math.min(compartmentId, neighborId);
    const b = Math.max(compartmentId, neighborId);
    const ov = overrides.find((o) => o.compartmentA === a && o.compartmentB === b);
    // A bordering row/column with no override pins the boundary to its grid line.
    const stepShift = ov
      ? isNear
        ? Math.max(ov.offsetStart, ov.offsetEnd)
        : Math.min(ov.offsetStart, ov.offsetEnd)
      : 0;
    shift = isNear ? Math.max(shift, stepShift) : Math.min(shift, stepShift);
  }
  return Number.isFinite(shift) ? shift : 0;
}

function dividerXShift(
  config: CompartmentConfig,
  compartmentId: number,
  bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number },
  side: 'left' | 'right'
): number {
  return dividerShift(config, compartmentId, bounds, side);
}

/**
 * The X span a compartment's label tab may occupy: the compartment's column
 * range, less half a divider on each side that has one, shifted to follow any
 * `dividerOverrides` on those dividers.
 *
 * The single source of truth for that span, shared by the worker that builds
 * the shelf, the ghost overlay that previews it and the socket planner that
 * sizes its plate. Deriving it from the nominal grid line instead left the
 * shelf floating off its wall and overhanging into the neighbour whenever a
 * divider was shifted.
 *
 * Returns null for an id that isn't in the grid.
 */
export function compartmentTabXSpan(
  config: CompartmentConfig,
  compartmentId: number,
  innerW: number
): CompartmentTabSpan | null {
  const bounds = getCompartmentBounds(config, compartmentId);
  if (!bounds) return null;

  const { cols, thickness } = config;
  const cellW = innerW / cols;
  const hasLeftWall = bounds.minCol > 0;
  const hasRightWall = bounds.maxCol < cols - 1;

  const left =
    -innerW / 2 +
    bounds.minCol * cellW +
    (hasLeftWall ? thickness / 2 + dividerXShift(config, compartmentId, bounds, 'left') : 0);
  const right =
    -innerW / 2 +
    (bounds.maxCol + 1) * cellW -
    (hasRightWall ? thickness / 2 - dividerXShift(config, compartmentId, bounds, 'right') : 0);

  return { left, right };
}

/**
 * True when a divider wall runs the FULL inner width at `row`'s anchor edge
 * (or that edge is the bin's own outer wall).
 *
 * Full-width label tabs hang off that wall, so a boundary where any
 * column's compartment continues straight through has nothing to carry the
 * shelf across its whole length. Shared by the worker, the ghost overlay and
 * the label-plate export so the three can't disagree about which rows get a
 * tab.
 */
export function rowHasFullWidthWall(
  config: CompartmentConfig,
  row: number,
  anchor: TabAnchorSide
): boolean {
  const { cols, rows, cells } = config;
  if (anchor === 'back' ? row === rows - 1 : row === 0) return true;
  const neighborRow = anchor === 'back' ? row + 1 : row - 1;
  for (let col = 0; col < cols; col++) {
    if (cells[row * cols + col] === cells[neighborRow * cols + col]) return false;
  }
  return true;
}

/**
 * Depth (mm) of the open region a spanning tab's body protrudes into: from
 * `row`'s anchor wall to the next full-width wall in the opposite direction.
 *
 * That — not the compartment the tab happens to start in — is what the body
 * has to fit inside, because a spanning tab crosses every column.
 */
export function spanRegionDepth(
  config: CompartmentConfig,
  row: number,
  anchor: TabAnchorSide,
  cellD: number
): number {
  const step = anchor === 'back' ? -1 : 1;
  let far = row;
  while (
    far + step >= 0 &&
    far + step < config.rows &&
    !rowHasFullWidthWall(config, far + step, anchor)
  ) {
    far += step;
  }
  return (Math.abs(row - far) + 1) * cellD;
}

/** Inputs a label tab's eligibility depends on, beyond the grid itself. */
export interface LabelTabFit {
  /** `label.depth` — how far the shelf body protrudes from its wall. */
  readonly tabDepth: number;
  /** `label.inset` — extra inward offset from the anchor wall. */
  readonly inset: number;
  /** Interior depth of one grid row (mm). */
  readonly cellD: number;
  /** True when `label.edges === 'both'`, which can make a front tab collide. */
  readonly bothEdges: boolean;
}

/**
 * Whether a per-compartment label tab can actually exist at `compartmentId`'s
 * given edge — the counterpart of {@link spanningTabEligible} for the default
 * (non-full-width) layout.
 *
 * Compartments are enforced rectangles, so every one has both a front and a
 * back anchor edge; what varies is whether the shelf fits and whether the wall
 * it hangs from is axis-aligned.
 *
 * The single source of truth for that question, shared by the worker that cuts
 * the socket, the ghost overlay that previews it and the plate planner that
 * ships a plate for it. Issue was the plate planner answering it
 * independently — and never asking about `edges` at all, so a design with a tab
 * on both edges shipped half the plates it needed.
 */
export function compartmentTabEligible(
  config: CompartmentConfig,
  compartmentId: number,
  anchor: TabAnchorSide,
  fit: LabelTabFit
): boolean {
  const bounds = getCompartmentBounds(config, compartmentId);
  if (!bounds) return false;

  // A tilted anchor wall breaks the axis-aligned wall the shelf and gusset
  // geometry assume.
  const hasTilt = anchor === 'back' ? compartmentHasTiltedBackWall : compartmentHasTiltedFrontWall;
  if (hasTilt(config, compartmentId)) return false;

  // The body would punch through the compartment's opposite wall.
  const compartmentDepth = (bounds.maxRow - bounds.minRow + 1) * fit.cellD;
  if (fit.tabDepth + fit.inset > compartmentDepth) return false;

  // With tabs on both edges, the front one is dropped where the pair would meet.
  if (fit.bothEdges && anchor === 'front' && 2 * fit.tabDepth + 2 * fit.inset > compartmentDepth) {
    return false;
  }

  return true;
}

/**
 * Whether a full-width label tab can actually exist at `row`'s anchor
 * wall.
 *
 * The single source of truth for that question. The worker builds the shelf,
 * the ghost overlay previews it and the label-plate export ships a plate for
 * it — if any of the three answered differently, the user would get a preview
 * that doesn't match the mesh, or a printed plate with no socket to click into.
 */
export function spanningTabEligible(
  config: CompartmentConfig,
  row: number,
  anchor: TabAnchorSide,
  fit: LabelTabFit
): boolean {
  // Nothing to hang the shelf from.
  if (!rowHasFullWidthWall(config, row, anchor)) return false;

  // A tilt anywhere along the boundary breaks the axis-aligned anchor wall the
  // shelf and gusset geometry assume.
  const { cols, cells } = config;
  const hasTilt = anchor === 'back' ? compartmentHasTiltedBackWall : compartmentHasTiltedFrontWall;
  for (let col = 0; col < cols; col++) {
    if (hasTilt(config, cells[row * cols + col])) return false;
  }

  // The body would punch through the wall bounding the far side.
  const regionDepth = spanRegionDepth(config, row, anchor, fit.cellD);
  if (fit.tabDepth + fit.inset > regionDepth) return false;

  // With tabs on both edges, the front one is dropped where the pair would meet.
  if (fit.bothEdges && anchor === 'front' && 2 * fit.tabDepth + 2 * fit.inset > regionDepth) {
    return false;
  }

  return true;
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
 * True when the compartment's FRONT wall is a tilted divider. Mirror of
 * `compartmentHasTiltedBackWall` for front-anchored label tabs.
 *
 * "Front" = the -Y direction in interior coords (the lower-row neighbor in
 * the cell grid). A front wall is tilted when the compartment has a front
 * neighbor (not touching the bin's actual front wall) AND a divider override
 * pairs the two compartments.
 */
export function compartmentHasTiltedFrontWall(
  config: CompartmentConfig,
  compartmentId: number
): boolean {
  const overrides = config.dividerOverrides;
  if (!overrides || overrides.length === 0) return false;
  const bounds = getCompartmentBounds(config, compartmentId);
  if (!bounds) return false;
  if (bounds.minRow === 0) return false;
  const frontRow = bounds.minRow - 1;
  const overrideKeys = new Set<string>();
  for (const o of overrides) {
    const a = Math.min(o.compartmentA, o.compartmentB);
    const b = Math.max(o.compartmentA, o.compartmentB);
    overrideKeys.add(`${a}|${b}`);
  }
  for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
    const neighborId = config.cells[frontRow * config.cols + col];
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
 * Reindex the parallel per-compartment swappable-label plate width overrides
 * through an `oldId → newId` map, mirroring `remapCompartmentTexts`. IDs
 * absent from the remap drop their override; new IDs (splits) get `null`
 * (auto width). Returns `undefined` when no numeric override survives —
 * the "no overrides set" state, matching the field's compact-storage
 * convention (`setCompartmentPlateWidth` does the same).
 */
export function remapLabelPlateWidths(
  oldWidths: readonly (number | null)[] | undefined,
  remap: ReadonlyMap<number, number>
): (number | null)[] | undefined {
  if (!oldWidths || oldWidths.length === 0) return undefined;
  let maxNewId = -1;
  for (const newId of remap.values()) {
    if (newId > maxNewId) maxNewId = newId;
  }
  const out: (number | null)[] = new Array<number | null>(maxNewId + 1).fill(null);
  let anySet = false;
  for (const [oldId, newId] of remap) {
    const w = oldWidths[oldId];
    if (typeof w === 'number') {
      out[newId] = w;
      anySet = true;
    }
  }
  return anySet ? out : undefined;
}

/**
 * Remap per-compartment plate icons across a `normalizeIdsWithRemap`
 * renumbering, exactly like `remapLabelPlateWidths` — icons whose
 * compartment vanished drop; new IDs get no icon.
 */
export function remapLabelIcons(
  oldIcons: readonly (string | null)[] | undefined,
  remap: ReadonlyMap<number, number>
): (string | null)[] | undefined {
  if (!oldIcons || oldIcons.length === 0) return undefined;
  let maxNewId = -1;
  for (const newId of remap.values()) {
    if (newId > maxNewId) maxNewId = newId;
  }
  const out: (string | null)[] = new Array<string | null>(maxNewId + 1).fill(null);
  let anySet = false;
  for (const [oldId, newId] of remap) {
    const icon = oldIcons[oldId];
    if (typeof icon === 'string') {
      out[newId] = icon;
      anySet = true;
    }
  }
  return anySet ? out : undefined;
}

/**
 * Remap per-compartment shadow-box colours across a `normalizeIdsWithRemap`
 * renumbering, exactly like `remapLabelIcons` — a colour whose compartment
 * vanished drops, and a new ID (a split) starts uncoloured. Without this the
 * colours stay indexed by ids that no longer mean the same compartment, and a
 * merge silently repaints unrelated cells (CLAUDE.md gotcha #6).
 */
export function remapCompartmentColors(
  oldColors: readonly (string | null)[] | undefined,
  remap: ReadonlyMap<number, number>
): (string | null)[] | undefined {
  if (!oldColors || oldColors.length === 0) return undefined;
  let maxNewId = -1;
  for (const newId of remap.values()) {
    if (newId > maxNewId) maxNewId = newId;
  }
  const out: (string | null)[] = new Array<string | null>(maxNewId + 1).fill(null);
  let anySet = false;
  for (const [oldId, newId] of remap) {
    const color = oldColors[oldId];
    if (typeof color === 'string' && color !== '') {
      out[newId] = color;
      anySet = true;
    }
  }
  return anySet ? out : undefined;
}

/**
 * Remap the per-compartment paint scopes in lockstep with
 * {@link remapCompartmentColors}. Kept separate rather than folded into one
 * object array so an existing design's `communityParamsFingerprint` only shifts
 * for the field it actually gained.
 */
export function remapCompartmentColorScopes(
  oldScopes: readonly (CompartmentColorScope | null)[] | undefined,
  remap: ReadonlyMap<number, number>
): (CompartmentColorScope | null)[] | undefined {
  if (!oldScopes || oldScopes.length === 0) return undefined;
  let maxNewId = -1;
  for (const newId of remap.values()) {
    if (newId > maxNewId) maxNewId = newId;
  }
  const out: (CompartmentColorScope | null)[] = new Array<CompartmentColorScope | null>(
    maxNewId + 1
  ).fill(null);
  let anySet = false;
  for (const [oldId, newId] of remap) {
    const scope = oldScopes[oldId];
    if (scope === 'floor' || scope === 'floorAndWalls') {
      out[newId] = scope;
      anySet = true;
    }
  }
  return anySet ? out : undefined;
}

/**
 * Best-effort carry of per-compartment label text across a grid-DIMENSION
 * change. `setCompartmentGrid` regenerates a fresh uniform grid, so the new
 * IDs can't be remapped from the old ones (CLAUDE.md gotcha #6 — there is no
 * `oldId → newId` correspondence). Instead we anchor each old compartment at its
 * lowest cell in data coordinates (`minCol`, `minRow`) and carry its label to
 * the new uniform cell at that same position — the one spatial mapping that's
 * unambiguous. Row 0 is the visual BOTTOM (the grid renders `flex-col-reverse`),
 * so `minRow` is the compartment's visual bottom; for the common single-cell
 * case `minRow === maxRow` so it doesn't matter. (Display numbering instead
 * anchors at the visual TOP — see `getCompartmentReadingOrder`,.)
 *
 * Labels whose anchor falls outside the new (smaller) grid have nowhere to land
 * and are dropped; `droppedCount` reports how many non-empty labels were lost so
 * the caller can warn instead of discarding them silently.
 *
 * Returns `texts` indexed by new compartment ID (`row * newCols + col`).
 */
export function carryCompartmentTextsByPosition(
  oldConfig: CompartmentConfig,
  newCols: number,
  newRows: number
): { texts: string[]; droppedCount: number } {
  const oldTexts = oldConfig.compartmentTexts;
  if (!oldTexts || oldTexts.length === 0) return { texts: [], droppedCount: 0 };

  const texts = new Array<string>(newCols * newRows).fill('');
  let droppedCount = 0;
  for (const id of getCompartmentIds(oldConfig)) {
    const label = oldTexts[id];
    if (typeof label !== 'string' || label.length === 0) continue;
    const bounds = getCompartmentBounds(oldConfig, id);
    if (!bounds) continue;
    if (bounds.minCol < newCols && bounds.minRow < newRows) {
      texts[bounds.minRow * newCols + bounds.minCol] = label;
    } else {
      droppedCount++;
    }
  }
  return { texts, droppedCount };
}

/**
 * Reindex the drawn-unit-cell markers through an `oldId → newId` remap,
 * mirroring `remapCompartmentTexts`. An ID that disappeared drops its marker;
 * an ID whose compartment is no longer 1×1 in `newCells` drops it too (a
 * multi-cell compartment is intrinsically drawn, so keeping the marker would
 * only leave a stale entry to resurface on a later split). Returns
 * `undefined` when nothing survives — the compact-storage convention every
 * optional compartment field follows.
 */
export function remapDrawnUnitCells(
  oldIds: readonly number[] | undefined,
  remap: ReadonlyMap<number, number>,
  newCells: readonly number[]
): number[] | undefined {
  if (!oldIds || oldIds.length === 0) return undefined;
  const counts = new Map<number, number>();
  for (const id of newCells) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const out: number[] = [];
  const seen = new Set<number>();
  for (const oldId of oldIds) {
    const newId = remap.get(oldId);
    if (newId === undefined || seen.has(newId)) continue;
    if (counts.get(newId) !== 1) continue;
    seen.add(newId);
    out.push(newId);
  }
  return out.length > 0 ? out.sort((a, b) => a - b) : undefined;
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
      ...(o.rakeDeg ? { rakeDeg: o.rakeDeg } : {}),
    });
  }
  return out;
}

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
