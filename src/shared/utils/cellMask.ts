/**
 * Cell mask utilities for non-rectangular bin footprints.
 *
 * A `CellMask` defines which half-bin-sized cells are filled. It uses
 * half-bin resolution unconditionally: a `width` × `depth` bin in grid
 * units has a `(2*width) × (2*depth)` mask. Each full grid cell is
 * represented by a 2×2 block of mask cells.
 *
 * Storage invariant: mask cells are row-major with row 0 = bottom.
 *   cells[row * cols + col] = 1 if filled, 0 if empty.
 *
 * A mask is "equivalent to a rectangle" when every cell is filled.
 * The generator detects this via `isAllFilled` and falls through to
 * the existing rectangle code path (no perf regression for the 99%
 * case of rectangular bins).
 */

/**
 * Always-half-bin-resolution cell mask. `cells` is row-major, origin bottom-left.
 *
 * Immutability contract: `cells` is typed as a mutable array so Immer's
 * `WritableDraft<CellMask>` continues to work in store slices, but callers
 * MUST NOT mutate elements in place — the array is frozen the first time
 * `maskToPolygon` sees a mask, and downstream features memoize on the
 * CellMask reference. Updates should construct a fresh mask (see
 * `buildFullMask` / `resizeMask`) rather than patch `cells[i]`.
 */
export interface CellMask {
  readonly cols: number;
  readonly rows: number;
  /** Row-major occupancy. Length must equal `cols * rows`. Values are 0 or 1. */
  readonly cells: (0 | 1)[];
}

/** Half-bin cells per grid unit (matches `HALF_BIN_SCALE` in core). */
export const MASK_CELLS_PER_UNIT = 2;

/** Cell size in grid units. */
export const MASK_CELL_SIZE = 1 / MASK_CELLS_PER_UNIT;

/** Hard cap: a 10×10 grid-unit bin → 20×20 mask cells = 400 cells. */
export const MAX_MASK_DIMENSION = 10 * MASK_CELLS_PER_UNIT;

/** Validation error kinds for mask checks. */
export type MaskValidationErrorKind =
  'dimension_mismatch' | 'empty' | 'disconnected' | 'out_of_bounds' | 'invalid_cell_value';

export interface MaskValidationError {
  readonly kind: MaskValidationErrorKind;
  readonly message: string;
}

/**
 * Build a fully-filled mask for a `width × depth` bin (in grid units).
 * Convenience for the "all cells filled" case.
 */
export function buildFullMask(widthUnits: number, depthUnits: number): CellMask {
  const cols = Math.round(widthUnits * MASK_CELLS_PER_UNIT);
  const rows = Math.round(depthUnits * MASK_CELLS_PER_UNIT);
  return { cols, rows, cells: new Array<0 | 1>(cols * rows).fill(1) };
}

/** True when every cell in the mask is filled (equivalent to a rectangle). */
export function isAllFilled(mask: CellMask): boolean {
  const { cells } = mask;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== 1) return false;
  }
  return true;
}

/**
 * Type guard: `true` when the mask is defined AND has at least one empty
 * cell — i.e., the generator should take the polygon path rather than the
 * rectangle fast-path. An undefined mask or a fully-filled one both
 * produce rectangles and share the existing cache bucket.
 */
export function isPartialMask(mask: CellMask | undefined): mask is CellMask {
  return mask !== undefined && !isAllFilled(mask);
}

/**
 * True when any 1u grid square has a mix of filled and empty half-bin
 * sub-cells. Cells that are uniformly filled or uniformly empty don't
 * count. A half-bin-only bin boundary (e.g. a half-cell cut into the side
 * of an otherwise-full 1u cell) makes the base generator switch to
 * half-sockets for that cell so the floor has a socket in every filled
 * half-cell region instead of a single full socket that would overhang
 * the cut.
 *
 * Trailing odd-dimension edges (the 0.5u fringe on a 1.5×1.5 bin) do
 * NOT count — those half-cells are already modelled as natural 0.5u
 * cells by the generator, so a fully-filled fractional bin returns
 * false here.
 */
export function hasHalfBinDetail(mask: CellMask): boolean {
  const { cols, rows, cells } = mask;
  // Inspect only origin-aligned full 2×2 blocks; the trailing odd
  // column/row is the fractional-edge fringe and gets half-cells
  // naturally — it doesn't indicate mixed-detail inside a 1u region.
  const wholeCols = cols - (cols % 2);
  const wholeRows = rows - (rows % 2);
  for (let r = 0; r < wholeRows; r += 2) {
    for (let c = 0; c < wholeCols; c += 2) {
      const topLeft = cells[r * cols + c];
      const topRight = cells[r * cols + c + 1];
      const bottomLeft = cells[(r + 1) * cols + c];
      const bottomRight = cells[(r + 1) * cols + c + 1];
      if (topLeft !== topRight || topLeft !== bottomLeft || topLeft !== bottomRight) {
        return true;
      }
    }
  }
  return false;
}

/** Count filled cells in the mask. */
export function countFilled(mask: CellMask): number {
  let n = 0;
  for (const c of mask.cells) {
    if (c === 1) n++;
  }
  return n;
}

/**
 * Validate a mask. Returns `null` on success, or the first error found.
 *
 * Checks:
 * - Dimensions match cells.length
 * - Cell values are 0 or 1
 * - At least one filled cell
 * - Within MAX_MASK_DIMENSION bounds
 * - All filled cells form one 4-connected component
 *
 * Enclosed empty cells (holes) are allowed — O-shapes and other
 * ring-topology footprints are valid; the generator builds a polygon
 * with inner hole loops.
 */
export function validateMask(mask: CellMask): MaskValidationError | null {
  const { cols, rows, cells } = mask;

  if (cols <= 0 || rows <= 0) {
    return {
      kind: 'dimension_mismatch',
      message: `cols/rows must be positive (got ${cols}×${rows})`,
    };
  }
  if (cols > MAX_MASK_DIMENSION || rows > MAX_MASK_DIMENSION) {
    return {
      kind: 'out_of_bounds',
      message: `mask exceeds ${MAX_MASK_DIMENSION}×${MAX_MASK_DIMENSION} half-cells (got ${cols}×${rows})`,
    };
  }
  if (cells.length !== cols * rows) {
    return {
      kind: 'dimension_mismatch',
      message: `cells.length (${cells.length}) does not match cols×rows (${cols * rows})`,
    };
  }

  let filledCount = 0;
  let firstFilled = -1;
  for (let i = 0; i < cells.length; i++) {
    // Cast to number to silence TS's literal narrowing — runtime values from
    // JSON loads or hand-built arrays may violate the 0 | 1 type.
    const v = cells[i] as number;
    if (v !== 0 && v !== 1) {
      return {
        kind: 'invalid_cell_value',
        message: `cell ${i} has invalid value ${String(v)} (must be 0 or 1)`,
      };
    }
    if (v === 1) {
      filledCount++;
      if (firstFilled === -1) firstFilled = i;
    }
  }

  if (filledCount === 0) {
    return { kind: 'empty', message: 'mask has no filled cells' };
  }

  // 4-connected single-component check via BFS from first filled cell.
  const visited = new Uint8Array(cells.length);
  const queue: number[] = [firstFilled];
  visited[firstFilled] = 1;
  let visitedCount = 1;

  while (queue.length > 0) {
    const idx = queue.pop();
    if (idx === undefined) break;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const neighbors: Array<[number, number]> = [
      [col - 1, row],
      [col + 1, row],
      [col, row - 1],
      [col, row + 1],
    ];
    for (const [nc, nr] of neighbors) {
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const nIdx = nr * cols + nc;
      if (visited[nIdx]) continue;
      if (cells[nIdx] !== 1) continue;
      visited[nIdx] = 1;
      visitedCount++;
      queue.push(nIdx);
    }
  }

  if (visitedCount !== filledCount) {
    return {
      kind: 'disconnected',
      message: `mask has ${filledCount - visitedCount} disconnected filled cell(s); must form a single 4-connected region`,
    };
  }

  return null;
}

/**
 * Resize a mask, preserving overlapping cells and filling new ones.
 *
 * - If new dims are smaller, cells outside the new bounds are dropped.
 * - If new dims are larger, new cells default to filled (1).
 * - If this would leave zero filled cells (e.g. all-empty mask shrunk to
 *   exclude its filled region), the result is still returned — validation
 *   is the caller's responsibility.
 */
export function resizeMask(prev: CellMask, newCols: number, newRows: number): CellMask {
  const cells = new Array<0 | 1>(newCols * newRows);
  for (let row = 0; row < newRows; row++) {
    for (let col = 0; col < newCols; col++) {
      const inPrev = col < prev.cols && row < prev.rows;
      cells[row * newCols + col] = inPrev ? prev.cells[row * prev.cols + col] : 1;
    }
  }
  return { cols: newCols, rows: newRows, cells };
}

/** Point in grid units — origin bottom-left of the bin bounding box. */
export interface Point2 {
  readonly x: number;
  readonly y: number;
}

/**
 * A closed boundary loop of a mask — row-major origin at (0, 0), values in
 * grid units. For `maskToPolygon`, the first element is the outer CCW
 * perimeter; subsequent elements are inner hole perimeters traversed CW
 * from the filled material's point of view.
 */
export type MaskLoop = readonly Point2[];

/**
 * Per-mask polygon cache — keyed by reference so pure-function callers
 * (socket/feature builders, wall patterns, mask drawing) skip the O(cells)
 * edge scan and loop chaining on repeated calls within one generation.
 * CellMask is declared immutable, so reference identity is sufficient.
 */
const maskToPolygonCache = new WeakMap<CellMask, readonly MaskLoop[]>();

/**
 * Convert a cell mask to its polygon loops: one outer (CCW) plus zero or
 * more inner holes (CW). Origin at (0, 0) in grid units (NOT mm — caller
 * multiplies by `gridUnitMm`). Vertices land only at corners where the
 * perimeter direction changes; collinear points are elided so downstream
 * sketch APIs see minimum-complexity polygons.
 *
 * Algorithm: collect every boundary edge (between filled and empty or
 * filled and out-of-bounds) with filled-region on the LEFT, then chain
 * edges into loops starting from unused edges until all are consumed.
 * The loop that encloses every other loop is the outer boundary; the
 * rest are holes.
 *
 * Result is memoized on the mask reference. To keep the cache sound we
 * also freeze `mask.cells` on first use — any subsequent in-place element
 * mutation throws in strict mode instead of silently returning a stale
 * polygon. Callers that need a modified mask must construct a new one.
 *
 * Preconditions: cells hold only 0/1, at least one cell is filled, and the
 * filled region is a single 4-connected component (so "the loop that
 * encloses every other" is well-defined). `validateMask` guarantees these
 * for bin-sized masks; drawer-scale callers (drawer-shape editor) enforce
 * them directly — the algorithm itself has no dimension cap, that is a
 * bin-designer authoring constraint.
 */
export function maskToPolygon(mask: CellMask): readonly MaskLoop[] {
  const cached = maskToPolygonCache.get(mask);
  if (cached) return cached;
  const { cols, rows, cells } = mask;
  if (!Object.isFrozen(cells)) {
    Object.freeze(cells);
  }
  const s = MASK_CELL_SIZE;
  const filled = (c: number, r: number): boolean =>
    c >= 0 && c < cols && r >= 0 && r < rows && cells[r * cols + c] === 1;

  type Edge = {
    readonly fx: number;
    readonly fy: number;
    readonly tx: number;
    readonly ty: number;
  };
  const edges: Edge[] = [];

  // For each filled cell, emit boundary edges (sides adjacent to empty/outside).
  // Directions chosen so filled is on the LEFT of the edge direction — this
  // makes the outer perimeter CCW and each enclosed hole CW.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cells[r * cols + c] !== 1) continue;
      const x0 = c * s;
      const y0 = r * s;
      const x1 = x0 + s;
      const y1 = y0 + s;
      // South edge (empty below): goes +X (filled above = left of direction)
      if (!filled(c, r - 1)) edges.push({ fx: x0, fy: y0, tx: x1, ty: y0 });
      // East edge (empty to right): goes +Y (filled to left)
      if (!filled(c + 1, r)) edges.push({ fx: x1, fy: y0, tx: x1, ty: y1 });
      // North edge (empty above): goes -X (filled below = left of direction)
      if (!filled(c, r + 1)) edges.push({ fx: x1, fy: y1, tx: x0, ty: y1 });
      // West edge (empty to left): goes -Y (filled to right = left of direction)
      if (!filled(c - 1, r)) edges.push({ fx: x0, fy: y1, tx: x0, ty: y0 });
    }
  }

  const key = (x: number, y: number): string => `${x},${y}`;
  // Saddle handling: at the corner shared by two diagonally-adjacent empty
  // cells, two outgoing edges start from the same vertex. Group by start so
  // both candidates survive (a plain Map would overwrite one).
  const byStart = new Map<string, Edge[]>();
  for (const e of edges) {
    const k = key(e.fx, e.fy);
    const list = byStart.get(k);
    if (list) list.push(e);
    else byStart.set(k, [e]);
  }

  // Index of the empty cell on the RIGHT of `e` (edges have filled-on-left by
  // construction). Two edges that bound the same empty cell belong to the same
  // hole loop — used at a saddle to chain edges from one hole together rather
  // than crossing the diagonal into the other hole.
  const rightCellKey = (e: Edge): number => {
    const dx = Math.sign(e.tx - e.fx);
    const dy = Math.sign(e.ty - e.fy);
    // Right-perpendicular of (dx, dy) is (dy, -dx); step half a half-cell.
    const cx = (e.fx + e.tx) / 2 + (dy * s) / 2;
    const cy = (e.fy + e.ty) / 2 - (dx * s) / 2;
    return Math.floor(cy / s) * cols + Math.floor(cx / s);
  };

  /** Collapse collinear runs → keep only vertices where direction changes. */
  const collapse = (walk: Edge[]): Point2[] => {
    const out: Point2[] = [];
    const n = walk.length;
    for (let i = 0; i < n; i++) {
      const prev = walk[(i - 1 + n) % n];
      const e = walk[i];
      if (Math.sign(prev.tx - prev.fx) !== Math.sign(e.tx - e.fx)) {
        out.push({ x: e.fx, y: e.fy });
        continue;
      }
      if (Math.sign(prev.ty - prev.fy) !== Math.sign(e.ty - e.fy)) {
        out.push({ x: e.fx, y: e.fy });
      }
    }
    return out;
  };

  /** Signed area of a closed polygon — positive for CCW, negative for CW. */
  const signedArea = (poly: readonly Point2[]): number => {
    let a = 0;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % n];
      a += p.x * q.y - q.x * p.y;
    }
    return a / 2;
  };

  // Chain edges into every closed loop. Consumption is tracked per edge (not
  // per start vertex) so both outgoing edges at a saddle can be walked.
  const loops: Point2[][] = [];
  const consumed = new Set<Edge>();
  for (const startEdge of edges) {
    if (consumed.has(startEdge)) continue;
    const walk: Edge[] = [];
    let cur: Edge | undefined = startEdge;
    while (cur && !consumed.has(cur)) {
      consumed.add(cur);
      walk.push(cur);
      const candidates = byStart.get(key(cur.tx, cur.ty));
      if (!candidates) break;
      const isSaddle = candidates.length > 1;
      const curRight: number = isSaddle ? rightCellKey(cur) : 0;
      let next: Edge | undefined;
      for (const c of candidates) {
        if (consumed.has(c)) continue;
        if (isSaddle && rightCellKey(c) !== curRight) continue;
        next = c;
        break;
      }
      cur = next;
    }
    if (walk.length > 0) loops.push(collapse(walk));
  }

  if (loops.length === 0) {
    throw new Error('maskToPolygon produced zero loops — mask may be empty');
  }

  // The outer boundary is the single CCW loop (positive signed area); every
  // other loop is a hole (CW, negative area). Having no CCW loop means the
  // filled region has no outer boundary, which shouldn't happen post-validation.
  const outerIdx = loops.findIndex((l) => signedArea(l) > 0);
  if (outerIdx < 0) {
    throw new Error('maskToPolygon found no outer (CCW) loop');
  }
  const holes = loops.filter((_, i) => i !== outerIdx);
  const result: readonly MaskLoop[] = [loops[outerIdx], ...holes];
  maskToPolygonCache.set(mask, result);
  return result;
}

/**
 * Classify a mask for filename / UI labelling.
 *
 * v1 returns only `'rectangle'` or `'custom'`. Classifying L/T/U/plus
 * reliably needs care (orientations, aspect ratios, mixed-resolution
 * half-cells) — deferred to a follow-up once real users produce shapes
 * we can eyeball.
 */
export function classifyShape(mask: CellMask): 'rectangle' | 'custom' {
  return isAllFilled(mask) ? 'rectangle' : 'custom';
}

/**
 * True if every mask cell overlapping the rectangle `[leftUnit, leftUnit+wUnits) ×
 * [bottomUnit, bottomUnit+dUnits)` (in grid units, origin bottom-left of the bin)
 * is filled. Used by the generator to decide whether a per-cell socket / feature
 * should be placed.
 *
 * Coordinates use a tolerance so floating-point arithmetic from
 * `gridUnitMm` conversions round to the nearest mask cell.
 */
export function isRegionFilled(
  mask: CellMask,
  leftUnit: number,
  bottomUnit: number,
  wUnits: number,
  dUnits: number
): boolean {
  const colStart = Math.round(leftUnit * MASK_CELLS_PER_UNIT);
  const rowStart = Math.round(bottomUnit * MASK_CELLS_PER_UNIT);
  const colEnd = Math.round((leftUnit + wUnits) * MASK_CELLS_PER_UNIT);
  const rowEnd = Math.round((bottomUnit + dUnits) * MASK_CELLS_PER_UNIT);
  if (colStart < 0 || rowStart < 0 || colEnd > mask.cols || rowEnd > mask.rows) {
    return false;
  }
  for (let r = rowStart; r < rowEnd; r++) {
    for (let c = colStart; c < colEnd; c++) {
      if (mask.cells[r * mask.cols + c] !== 1) return false;
    }
  }
  return true;
}

/**
 * Stable, short hash for a mask — suitable for inclusion in cache keys.
 * Uses a 32-bit FNV-1a over the canonicalized `cols|rows|cells`.
 */
export function hashMask(mask: CellMask): string {
  const { cols, rows, cells } = mask;
  let h = 2166136261;
  h = Math.imul(h ^ cols, 16777619);
  h = Math.imul(h ^ rows, 16777619);
  for (let i = 0; i < cells.length; i++) {
    h = Math.imul(h ^ cells[i], 16777619);
  }
  // Convert to unsigned + base36 for compactness.
  return (h >>> 0).toString(36);
}
