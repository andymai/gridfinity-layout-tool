/**
 * User-drawn split plans — pure conversions between the stored
 * chunk-size form ({@link SplitOverride}) and the seam offsets the mini-map
 * editor draws, plus the validity check that decides whether a stored plan
 * still describes the current plate.
 *
 * The editor and the planner speak different languages on purpose. The planner
 * has always consumed chunk SIZES (`colSizes`/`rowSizes`), so an override in
 * that form drops straight into `computeBaseplateTiling` with no downstream
 * change. A user, though, places CUTS — so the UI works in seam offsets from
 * the axis start and converts at the boundary.
 */

import { gridUnits } from '@gridfinity/branded-types';
import type { FractionalEdge, SplitOverride } from '@/core/types';
import { FRACTIONAL_THRESHOLD } from './splitReorder';

/** Grid units are half-unit-quantized, so this is well below one step. */
const EPSILON = 1e-6;

/**
 * Cell sizes along an axis, front-to-back: all 1-unit cells plus the half cell
 * a fractional total contributes, at the edge `fractionalEdge` names.
 *
 * This is the whole reason seam placement needs no fractional special-casing
 * anywhere else: cuts land on cell boundaries by construction, so the half unit
 * can only ever end up on the outermost chunk — exactly the invariant
 * `computeBaseplateTiling` already assumes when it tags a piece's
 * `fractionalEdgeX`/`Y`.
 */
function cellSizes(total: number, fractionalEdge: FractionalEdge): number[] {
  const whole = Math.floor(total + EPSILON);
  const hasHalf = total - whole >= FRACTIONAL_THRESHOLD;
  const cells: number[] = new Array<number>(whole).fill(1);
  if (!hasHalf) return cells;
  return fractionalEdge === 'start' ? [0.5, ...cells] : [...cells, 0.5];
}

/**
 * Every offset (in grid units from the axis start) where a seam may be placed:
 * the interior cell boundaries. Excludes 0 and `total`, which are the plate's
 * own edges rather than cuts.
 */
export function seamPositions(total: number, fractionalEdge: FractionalEdge): number[] {
  const cells = cellSizes(total, fractionalEdge);
  const positions: number[] = [];
  let offset = 0;
  for (let i = 0; i < cells.length - 1; i++) {
    offset += cells[i];
    positions.push(offset);
  }
  return positions;
}

/** Chunk sizes → the sorted seam offsets that produce them. */
export function chunksToSeams(chunks: readonly number[]): number[] {
  const seams: number[] = [];
  let offset = 0;
  for (let i = 0; i < chunks.length - 1; i++) {
    offset += chunks[i];
    seams.push(offset);
  }
  return seams;
}

/** Seam offsets (any order) → the chunk sizes they cut `total` into. */
export function seamsToChunks(seams: readonly number[], total: number): number[] {
  const sorted = [...seams].sort((a, b) => a - b);
  const chunks: number[] = [];
  let previous = 0;
  for (const seam of sorted) {
    chunks.push(seam - previous);
    previous = seam;
  }
  chunks.push(total - previous);
  return chunks;
}

/** Add `seam` if absent, remove it if present. Returns the new offsets, sorted. */
export function toggleSeam(seams: readonly number[], seam: number): number[] {
  const without = seams.filter((s) => Math.abs(s - seam) > EPSILON);
  const next = without.length === seams.length ? [...seams, seam] : without;
  return next.sort((a, b) => a - b);
}

function chunksValid(
  chunks: readonly number[],
  total: number,
  fractionalEdge: FractionalEdge
): boolean {
  if (chunks.length === 0) return false;
  if (chunks.some((c) => !Number.isFinite(c) || c <= 0)) return false;
  const sum = chunks.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - total) > EPSILON) return false;
  // Every interior cut must land on a cell boundary. Checking the offsets
  // rather than the sizes rejects a plan that sums correctly but slices through
  // a cell — including one that puts the half unit somewhere other than its
  // fractional edge, which would hand a piece a fraction the generator places
  // on the wrong side.
  const allowed = seamPositions(total, fractionalEdge);
  return chunksToSeams(chunks).every((seam) =>
    allowed.some((position) => Math.abs(position - seam) <= EPSILON)
  );
}

/**
 * The stored plan if it still describes this plate, otherwise undefined.
 *
 * Called from `buildFullParams`, so a plan orphaned by a grid resize, a
 * fractional-edge flip, or a malformed synced payload never reaches the planner
 * — the plate silently falls back to the automatic tiling. This is the same
 * normalization contract the optional baseplate flags follow, with real shape
 * checking on top: the field is allowlisted server-side without a type check,
 * so nothing here may assume it is even an array.
 */
export function normalizeSplitOverride(
  override: SplitOverride | undefined,
  width: number,
  depth: number,
  fractionalEdgeX: FractionalEdge,
  fractionalEdgeY: FractionalEdge
): SplitOverride | undefined {
  if (override === undefined) return undefined;
  const { cols, rows } = override;
  if (!Array.isArray(cols) || !Array.isArray(rows)) return undefined;
  if (!chunksValid(cols, width, fractionalEdgeX)) return undefined;
  if (!chunksValid(rows, depth, fractionalEdgeY)) return undefined;
  return override;
}

/** Build a stored plan from seam offsets on each axis. */
export function splitOverrideFromSeams(
  colSeams: readonly number[],
  rowSeams: readonly number[],
  width: number,
  depth: number
): SplitOverride {
  return {
    cols: seamsToChunks(colSeams, width).map(gridUnits),
    rows: seamsToChunks(rowSeams, depth).map(gridUnits),
  };
}
