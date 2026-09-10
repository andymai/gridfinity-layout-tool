/** Per-axis piece tiling for a split baseplate: bed capacity, partition search and the padding hint. */

import type { ResolvedBaseplateParams } from '@/shared/types/bin';
// The fit checker subtracts the tongue protrusion from the bed budget on male
// join edges — otherwise pieces that compute to exactly the bed width on paper
// exceed it as STLs.
import { TONGUE_PROTRUSION } from '@/shared/constants/connectors';
import { MARGIN_MIN_DETACH_MM } from '@/core/baseplateDefaults';
import type { BaseplatePiece, PaddingReductionHint, PieceBedOverage } from '../types/tiling';
import { estimateBedLoads, type Footprint } from './bedPacking';
import { FRACTIONAL_THRESHOLD } from './splitReorder';

/** Float slack for bed-fit comparisons — a chunk within this of the bed fits. */
const TOLERANCE_MM = 0.001;

/** Convert a zero-based column index to a letter: 0→A, 1→B, ..., 25→Z */
export function colToLetter(col: number): string {
  return String.fromCharCode(65 + col);
}

/** Which sides detach into rails: padding ≥ threshold and the flag is on. */
export function detachedSides(params: ResolvedBaseplateParams): {
  left: boolean;
  right: boolean;
  front: boolean;
  back: boolean;
} {
  const on = !!params.detachMargins;
  return {
    left: on && params.paddingLeft >= MARGIN_MIN_DETACH_MM,
    right: on && params.paddingRight >= MARGIN_MIN_DETACH_MM,
    front: on && params.paddingFront >= MARGIN_MIN_DETACH_MM,
    back: on && params.paddingBack >= MARGIN_MIN_DETACH_MM,
  };
}

/**
 * Max extra pieces worth one saved build-plate load. Doubles as the bed-load
 * weight in the tiling cost (`LOAD_WEIGHT * bedLoads + pieceCount`): a finer
 * split that removes a load wins only if it adds fewer than this many pieces,
 * so the planner pursues fewer bed swaps without fragmenting into tiny tiles.
 *
 * Set to 2: one saved load is worth at most one extra piece. Each extra
 * piece is another dovetailed seam to print, align, and glue, and the finer
 * split's load saving is only realized if the user re-derives the non-obvious
 * cross-row bed packing (the print guide groups pieces by grid position, not by
 * bed). So adding 2+ pieces to save a single load is a bad trade for most users
 * — they'd rather print the coarser split's few large pieces one-per-bed.
 */
const MAX_EXTRA_PIECES_PER_BED_LOAD = 2;

/**
 * Only run the packing-aware refinement when the coarsest split has at most this
 * many pieces. Beyond it the plate dwarfs the bed (pieces already tile beds
 * tightly, so packing can't save loads) and the per-candidate packing cost
 * would balloon — so large plates keep the fast min-piece tiling.
 */
const PACKING_SEARCH_MAX_PIECES = 16;

/**
 * Per-axis configuration: bed budget, padding, and dovetail overhang on each end.
 *
 * `startMaleMm` / `endMaleMm` are the mm reserved for a male tongue when that
 * side is a join edge. Convention (matches `buildConnectors` in baseplateGenerator):
 *   left/front are male when invertDovetails=false; right/back are male otherwise.
 * Females cut into the slab and don't extend its bbox, so they cost nothing.
 */
interface AxisConfig {
  readonly bedMm: number;
  /** This axis's cell pitch in mm (X = gridUnitMm, Y = the non-square Y pitch). */
  readonly gridUnitMm: number;
  readonly paddingStart: number;
  readonly paddingEnd: number;
  readonly startMaleMm: number;
  readonly endMaleMm: number;
  /**
   * Outline overhang on each outer end, kept separate from padding: it
   * is not user-settable, so the padding-reduction hint must not offer to give
   * it back. Positionally identical to padding otherwise — only the first/last
   * chunk carries it, matching how `pieceToBaseplateParams` hands the overhang
   * to the outermost pieces alone.
   */
  readonly overhangStart: number;
  readonly overhangEnd: number;
}

export function makeAxisConfig(
  bedMm: number,
  gridUnitMm: number,
  paddingStart: number,
  paddingEnd: number,
  connectorNubs: boolean | undefined,
  invertDovetails: boolean | undefined,
  preferIdenticalPieces: boolean | undefined,
  overhangStart: number = 0,
  overhangEnd: number = 0
): AxisConfig {
  // Both axes follow the same rule: the start side (left / front) is male iff !invertDovetails.
  // Under preferIdenticalPieces, every join edge places a tongue+groove pair —
  // so both sides claim a tongue and the bed budget must reserve for both,
  // not just the conventionally-male side.
  const tongue = connectorNubs ? TONGUE_PROTRUSION : 0;
  const paired = !!preferIdenticalPieces && !!connectorNubs;
  const ends = { overhangStart, overhangEnd };
  if (paired) {
    return {
      bedMm,
      gridUnitMm,
      paddingStart,
      paddingEnd,
      startMaleMm: tongue,
      endMaleMm: tongue,
      ...ends,
    };
  }
  const startMale = !invertDovetails;
  return {
    bedMm,
    gridUnitMm,
    paddingStart,
    paddingEnd,
    startMaleMm: startMale ? tongue : 0,
    endMaleMm: startMale ? 0 : tongue,
    ...ends,
  };
}

/**
 * Per-position max grid-unit capacity for a multi-chunk axis.
 * Multi-piece pieces give up bed-budget on each join edge whose tongue is male.
 * Middle chunks have both sides joined, but exactly one is male regardless of
 * invert orientation, so this collapses to a single TONGUE_PROTRUSION.
 */
export function axisCapacity(axis: AxisConfig): {
  maxFirst: number;
  maxLast: number;
  maxMiddle: number;
} {
  const { bedMm, gridUnitMm, paddingStart, paddingEnd, startMaleMm, endMaleMm } = axis;
  return {
    maxFirst: Math.floor((bedMm - paddingStart - axis.overhangStart - endMaleMm) / gridUnitMm),
    maxLast: Math.floor((bedMm - paddingEnd - axis.overhangEnd - startMaleMm) / gridUnitMm),
    maxMiddle: Math.floor((bedMm - startMaleMm - endMaleMm) / gridUnitMm),
  };
}

/**
 * Partition `totalUnits` into exactly `numChunks` pieces that each fit the bed.
 *
 * Position-aware padding: first chunk carries `paddingStart`, last carries
 * `paddingEnd`, middle chunks use the full bed. A single chunk carries both.
 *
 * Distributes units as equally as possible (minimizing variance) to support
 * the symmetry tiebreaker. Returns null if the partition is infeasible.
 */
function partitionAxis(totalUnits: number, numChunks: number, axis: AxisConfig): number[] | null {
  const { bedMm, gridUnitMm, paddingStart, paddingEnd, startMaleMm } = axis;
  const intPart = Math.floor(totalUnits);
  const hasFrac = totalUnits - intPart >= FRACTIONAL_THRESHOLD;

  // Single-piece (numChunks=1) has no joins, so no tongue overhead — but it is
  // both the first and last chunk, so it carries both ends' padding AND overhang.
  const bothEndsMm = paddingStart + paddingEnd + axis.overhangStart + axis.overhangEnd;
  const maxWithBoth = Math.floor((bedMm - bothEndsMm) / gridUnitMm);
  const { maxFirst, maxLast, maxMiddle } = axisCapacity(axis);

  // Degenerate: bed can't hold even 1 unit in any position
  if (maxWithBoth < 1 || maxFirst < 1 || maxLast < 1 || maxMiddle < 1) {
    return numChunks === 1 ? [totalUnits] : null;
  }

  if (numChunks === 1) {
    if (intPart > maxWithBoth) return null;
    if (hasFrac) {
      if ((intPart + 0.5) * gridUnitMm + bothEndsMm <= bedMm) {
        return [totalUnits];
      }
      return null;
    }
    return intPart > 0 ? [intPart] : null;
  }

  const maxPerPos: number[] = Array.from({ length: numChunks }, (_, i) => {
    if (i === 0) return maxFirst;
    if (i === numChunks - 1) return maxLast;
    return maxMiddle;
  });

  const totalCapacity = maxPerPos.reduce((a, b) => a + b, 0);
  if (totalCapacity < intPart) return null;

  // Pass 1: distribute evenly — floor(intPart / numChunks) per chunk, with
  // the remainder distributed one unit at a time from the first chunk onward.
  // Clamp each chunk to its position cap; any overflow is deferred to pass 2.
  const baseSize = Math.floor(intPart / numChunks);
  const sizes: number[] = new Array<number>(numChunks).fill(baseSize);
  let remainder = intPart - baseSize * numChunks;

  for (let i = 0; i < numChunks; i++) {
    if (sizes[i] > maxPerPos[i]) {
      remainder += sizes[i] - maxPerPos[i];
      sizes[i] = maxPerPos[i];
    }
  }

  for (let i = 0; i < numChunks && remainder > 0; i++) {
    const canAdd = maxPerPos[i] - sizes[i];
    if (canAdd > 0) {
      const add = Math.min(1, canAdd);
      sizes[i] += add;
      remainder--;
    }
  }

  // Pass 2: redistribute any remaining units into slots that still have capacity.
  for (let i = 0; i < numChunks && remainder > 0; i++) {
    const canAdd = maxPerPos[i] - sizes[i];
    const add = Math.min(canAdd, remainder);
    sizes[i] += add;
    remainder -= add;
  }

  if (remainder > 0) return null;
  if (sizes.some((s) => s <= 0)) return null;

  // Handle fractional 0.5 unit — absorb into last chunk if it fits
  if (hasFrac) {
    const lastIdx = numChunks - 1;
    const lastOverhead = paddingEnd + axis.overhangEnd + startMaleMm;
    if ((sizes[lastIdx] + 0.5) * gridUnitMm + lastOverhead <= bedMm) {
      sizes[lastIdx] += 0.5;
    } else {
      return null;
    }
  }

  return sizes;
}

/**
 * Verify every piece fits the bed. Each piece's physical width depends only
 * on its column index and depth on its row index, so the two axes are
 * independent — checking each axis separately is sufficient.
 */
function allPiecesFit(
  colSizes: number[],
  rowSizes: number[],
  xAxis: AxisConfig,
  yAxis: AxisConfig
): boolean {
  return chunkSizesFit(colSizes, xAxis) && chunkSizesFit(rowSizes, yAxis);
}

/**
 * Per-position physical size (mm) of each chunk on an axis — grid units plus
 * edge padding, the outline overhang, and join-edge tongue protrusion (matches
 * the actual STL bounding boxes). First/last chunks carry their exterior
 * padding and overhang; join edges (interior sides) carry a male tongue's
 * protrusion when the convention assigns male to that side, while female sides
 * cut into the slab and add nothing.
 *
 * The overhang belongs here for the same reason the tongue does:
 * the generator widens the outermost pieces' slabs by it, so it is real printed
 * material on the outer faces. Omitting it let the planner emit an outer piece
 * that overshoots the bed — invisible until the slicer refused the STL.
 */
function axisChunkMm(sizes: number[], axis: AxisConfig): number[] {
  const last = sizes.length - 1;
  return sizes.map((s, i) => {
    const padStart = i === 0 ? axis.paddingStart + axis.overhangStart : 0;
    const padEnd = i === last ? axis.paddingEnd + axis.overhangEnd : 0;
    const tongueStart = i === 0 ? 0 : axis.startMaleMm;
    const tongueEnd = i === last ? 0 : axis.endMaleMm;
    return s * axis.gridUnitMm + padStart + padEnd + tongueStart + tongueEnd;
  });
}

function chunkSizesFit(sizes: number[], axis: AxisConfig): boolean {
  return axisChunkMm(sizes, axis).every((mm) => mm <= axis.bedMm + TOLERANCE_MM);
}

/** Build-plate loads to print a candidate tiling, packing pieces per bed. */
export function tilingBedLoads(
  colSizes: number[],
  rowSizes: number[],
  xAxis: AxisConfig,
  yAxis: AxisConfig
): number {
  const colMm = axisChunkMm(colSizes, xAxis);
  const rowMm = axisChunkMm(rowSizes, yAxis);
  const footprints: Footprint[] = [];
  for (const d of rowMm) for (const w of colMm) footprints.push({ w, d });
  return estimateBedLoads(footprints, xAxis.bedMm, yAxis.bedMm);
}

/** Variance of an array — lower = more symmetric/equal. */
function symmetryScore(sizes: number[]): number {
  if (sizes.length <= 1) return 0;
  const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  return sizes.reduce((sum, s) => sum + (s - mean) ** 2, 0) / sizes.length;
}

interface MinPieceCandidate {
  colSizes: number[];
  rowSizes: number[];
  pieceCount: number;
  variance: number;
}

/**
 * Coarsest feasible tiling: minimum piece count where every piece fits the bed,
 * symmetry breaking ties. Fast (no packing) — used as both the baseline answer
 * for large plates and the seed for the packing-aware refinement.
 */
function findMinPieceTiling(
  totalWidth: number,
  totalDepth: number,
  xAxis: AxisConfig,
  yAxis: AxisConfig
): MinPieceCandidate | null {
  const maxCols = Math.ceil(totalWidth);
  const maxRows = Math.ceil(totalDepth);
  let best: MinPieceCandidate | null = null;

  for (let nc = 1; nc <= maxCols; nc++) {
    if (best && nc > best.pieceCount) break;
    const colSizes = partitionAxis(totalWidth, nc, xAxis);
    if (!colSizes) continue;

    for (let nr = 1; nr <= maxRows; nr++) {
      const pieceCount = nc * nr;
      if (best && pieceCount > best.pieceCount) break;
      const rowSizes = partitionAxis(totalDepth, nr, yAxis);
      if (!rowSizes) continue;
      if (allPiecesFit(colSizes, rowSizes, xAxis, yAxis)) {
        const variance = symmetryScore(colSizes) + symmetryScore(rowSizes);
        if (!best || pieceCount < best.pieceCount || variance < best.variance) {
          best = { colSizes, rowSizes, pieceCount, variance };
        }
        break;
      }
    }
  }
  return best;
}

interface TilingCandidate {
  colSizes: number[];
  rowSizes: number[];
  pieceCount: number;
  cost: number;
  variance: number;
}

/**
 * Find the optimal grid tiling: fewest build-plate loads (with a per-load piece
 * budget), where every piece fits the bed.
 *
 * First finds the coarsest (min-piece) tiling. When that already has many
 * pieces the plate dwarfs the bed — its big pieces tile beds tightly, so
 * packing-aware refinement can't help and would be expensive; we return it
 * directly. Otherwise we search (numCols, numRows) pairs, scoring each feasible
 * candidate by `MAX_EXTRA_PIECES_PER_BED_LOAD * bedLoads + pieceCount`
 * (symmetry breaks ties). Since `bedLoads ≥ 1`, a candidate's cost is at least
 * `pieceCount + MAX_EXTRA_PIECES_PER_BED_LOAD`, bounding the search. Returns the
 * best (colSizes, rowSizes) or a single-piece fallback; the caller recomputes
 * the final bed-load count after display reordering.
 */
export function findOptimalTiling(
  totalWidth: number,
  totalDepth: number,
  xAxis: AxisConfig,
  yAxis: AxisConfig
): { colSizes: number[]; rowSizes: number[] } {
  const coarse = findMinPieceTiling(totalWidth, totalDepth, xAxis, yAxis);
  if (!coarse) {
    return { colSizes: [totalWidth], rowSizes: [totalDepth] };
  }

  const coarseBedLoads = tilingBedLoads(coarse.colSizes, coarse.rowSizes, xAxis, yAxis);

  // Large plate: the coarse split already packs near-optimally and the packing
  // search would be costly — keep it.
  if (coarse.pieceCount > PACKING_SEARCH_MAX_PIECES) {
    return { colSizes: coarse.colSizes, rowSizes: coarse.rowSizes };
  }

  const maxCols = Math.ceil(totalWidth);
  const maxRows = Math.ceil(totalDepth);

  // Seed with the coarse tiling so the cost prune is tight from the start.
  let best: TilingCandidate = {
    colSizes: coarse.colSizes,
    rowSizes: coarse.rowSizes,
    pieceCount: coarse.pieceCount,
    cost: MAX_EXTRA_PIECES_PER_BED_LOAD * coarseBedLoads + coarse.pieceCount,
    variance: coarse.variance,
  };

  for (let nc = 1; nc <= maxCols; nc++) {
    // Lower-bound prune: this column count alone (nr=1, 1 bed load) can't beat
    // the best cost found so far. `>` not `>=` so equal-cost candidates still
    // get evaluated for the symmetry tiebreak.
    if (nc + MAX_EXTRA_PIECES_PER_BED_LOAD > best.cost) break;

    const colSizes = partitionAxis(totalWidth, nc, xAxis);
    if (!colSizes) continue;

    for (let nr = 1; nr <= maxRows; nr++) {
      const pieceCount = nc * nr;
      // pieceCount keeps growing with nr; once even a 1-load split can't beat
      // best, no larger nr will either.
      if (pieceCount + MAX_EXTRA_PIECES_PER_BED_LOAD > best.cost) break;

      const rowSizes = partitionAxis(totalDepth, nr, yAxis);
      if (!rowSizes) continue;
      if (!allPiecesFit(colSizes, rowSizes, xAxis, yAxis)) continue;

      const bedLoads = tilingBedLoads(colSizes, rowSizes, xAxis, yAxis);
      const cost = MAX_EXTRA_PIECES_PER_BED_LOAD * bedLoads + pieceCount;
      const variance = symmetryScore(colSizes) + symmetryScore(rowSizes);
      if (cost < best.cost || (cost === best.cost && variance < best.variance)) {
        best = { colSizes, rowSizes, pieceCount, cost, variance };
      }
    }
  }

  return { colSizes: best.colSizes, rowSizes: best.rowSizes };
}

/**
 * Check if reducing padding would eliminate a split or save pieces.
 * Tries X-only, Y-only, then both axes together; picks the best result.
 */
export function computePaddingReductionHint(
  totalWidth: number,
  totalDepth: number,
  xAxis: AxisConfig,
  yAxis: AxisConfig,
  currentPieceCount: number
): PaddingReductionHint | null {
  if (currentPieceCount <= 1) return null;

  const reduceX = Math.min(xAxis.paddingStart, xAxis.paddingEnd);
  const reduceY = Math.min(yAxis.paddingStart, yAxis.paddingEnd);

  // Find smallest reduction along an axis that saves pieces; null if none works.
  // Uses the full packing-aware tiling (not the cheaper min-piece search) so the
  // "saves N pieces" hint matches the split the user actually sees after reducing.
  const trySaving = (maxR: number, build: (r: number) => { x: AxisConfig; y: AxisConfig }) => {
    for (let r = 1; r <= maxR; r++) {
      const { x, y } = build(r);
      const result = findOptimalTiling(totalWidth, totalDepth, x, y);
      const saved = currentPieceCount - result.colSizes.length * result.rowSizes.length;
      if (saved > 0) return { reductionMm: r, piecesSaved: saved };
    }
    return null;
  };

  const reduce = (axis: AxisConfig, r: number): AxisConfig => ({
    ...axis,
    paddingStart: axis.paddingStart - r,
    paddingEnd: axis.paddingEnd - r,
  });

  const candidates: PaddingReductionHint[] = [];
  const x = trySaving(reduceX, (r) => ({ x: reduce(xAxis, r), y: yAxis }));
  if (x) candidates.push({ axis: 'x', ...x });
  const y = trySaving(reduceY, (r) => ({ x: xAxis, y: reduce(yAxis, r) }));
  if (y) candidates.push({ axis: 'y', ...y });
  const both = trySaving(Math.min(reduceX, reduceY), (r) => ({
    x: reduce(xAxis, r),
    y: reduce(yAxis, r),
  }));
  if (both) candidates.push({ axis: 'both', ...both });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.piecesSaved - a.piecesSaved || a.reductionMm - b.reductionMm);
  return candidates[0];
}

/**
 * Pieces whose printed footprint exceeds the bed, with the mm overage per axis.
 *
 * Uses `axisChunkMm` — the same budget the planner's own feasibility check runs
 * on, including exterior padding, the outline overhang, and male tongue
 * protrusion — so a user-drawn plan is held to exactly the standard the
 * automatic planner holds itself to. Like `chunkSizesFit`, it deliberately does
 * NOT consider a 90° rotation onto a non-square bed: the bed packer rotates
 * pieces to fit more per load, but the planner never treats a rotation as
 * making an otherwise-too-large piece feasible, and a warning that disagreed
 * with the planner would let a custom plan pass a check the automatic one fails.
 *
 * Non-empty on an automatic plan only in the degenerate case where the bed
 * cannot hold a single grid unit and `partitionAxis` falls back to one
 * oversized piece.
 */
export function computeBedOverages(
  pieces: readonly BaseplatePiece[],
  colSizes: number[],
  rowSizes: number[],
  xAxis: AxisConfig,
  yAxis: AxisConfig
): PieceBedOverage[] {
  const colMm = axisChunkMm(colSizes, xAxis);
  const rowMm = axisChunkMm(rowSizes, yAxis);
  const overages: PieceBedOverage[] = [];
  for (const piece of pieces) {
    const overWidthMm = colMm[piece.col] - xAxis.bedMm;
    const overDepthMm = rowMm[piece.row] - yAxis.bedMm;
    if (overWidthMm > TOLERANCE_MM || overDepthMm > TOLERANCE_MM) {
      overages.push({
        label: piece.label,
        overWidthMm: overWidthMm > TOLERANCE_MM ? overWidthMm : 0,
        overDepthMm: overDepthMm > TOLERANCE_MM ? overDepthMm : 0,
      });
    }
  }
  return overages;
}
