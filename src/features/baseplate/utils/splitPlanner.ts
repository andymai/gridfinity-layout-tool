/**
 * Baseplate split planner — pure functions for computing how a large baseplate
 * should be tiled into printable pieces.
 *
 * The algorithm jointly optimizes both axes to minimize the number of
 * build-plate loads (print jobs) — packing as many pieces as fit per bed — so
 * users print in the fewest bed swaps. Because smaller pieces pack tighter,
 * fewer bed loads usually means more pieces; a per-load piece budget
 * ({@link MAX_EXTRA_PIECES_PER_BED_LOAD}) caps that trade so the planner won't
 * fragment into many tiny tiles just to shave a load. For each candidate
 * (numCols × numRows) it verifies every piece fits the bed with its
 * edge-specific padding, scores `LOAD_WEIGHT * bedLoads + pieceCount`, and
 * breaks ties by symmetry (prefer equal-sized pieces).
 *
 * Fractional half-unit edges are absorbed into the outermost piece when they
 * fit, otherwise become a separate piece.
 */

import type {
  BaseplateEdgeKind,
  ConnectorBoundaryFilter,
  ResolvedBaseplateParams,
} from '@/shared/types/bin';
import { isExteriorEdge, isMarginSeamStyle } from '@/shared/types/bin';
import { interiorBoundaryOffsetsMm } from './connectorKeys';
// The fit checker subtracts the tongue protrusion from the bed budget on male
// join edges — otherwise pieces that compute to exactly the bed width on paper
// exceed it as STLs.
import { TONGUE_PROTRUSION } from '@/shared/constants/connectors';
import { MARGIN_MIN_DETACH_MM } from '@/core/baseplateDefaults';
import { GRIDFINITY } from '@/shared/constants/bin';
import type {
  BaseplatePiece,
  BaseplateTiling,
  MarginCorner,
  MarginPiece,
  PaddingReductionHint,
  PieceBedOverage,
  PieceEdges,
} from '../types/tiling';
import { estimateBedLoads, type Footprint } from './bedPacking';
import type { DrawerOutline } from '@/core/types';
import { rotateOutline180, translateOutline } from '@/shared/utils/drawerOutline';
import { classifyRect, type RegionClass } from '@/shared/utils/drawerOutlineGeometry';
import { FRACTIONAL_THRESHOLD, isFractional, reorderForDisplay } from './splitReorder';

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

function makeAxisConfig(
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
function axisCapacity(axis: AxisConfig): { maxFirst: number; maxLast: number; maxMiddle: number } {
  const { bedMm, gridUnitMm, paddingStart, paddingEnd, startMaleMm, endMaleMm } = axis;
  return {
    maxFirst: Math.floor((bedMm - paddingStart - axis.overhangStart - endMaleMm) / gridUnitMm),
    maxLast: Math.floor((bedMm - paddingEnd - axis.overhangEnd - startMaleMm) / gridUnitMm),
    maxMiddle: Math.floor((bedMm - startMaleMm - endMaleMm) / gridUnitMm),
  };
}

/** Convert a zero-based column index to a letter: 0→A, 1→B, ..., 25→Z */
export function colToLetter(col: number): string {
  return String.fromCharCode(65 + col);
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

/** Float slack for bed-fit comparisons — a chunk within this of the bed fits. */
const TOLERANCE_MM = 0.001;

function chunkSizesFit(sizes: number[], axis: AxisConfig): boolean {
  return axisChunkMm(sizes, axis).every((mm) => mm <= axis.bedMm + TOLERANCE_MM);
}

/** Variance of an array — lower = more symmetric/equal. */
function symmetryScore(sizes: number[]): number {
  if (sizes.length <= 1) return 0;
  const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  return sizes.reduce((sum, s) => sum + (s - mean) ** 2, 0) / sizes.length;
}

/** Build-plate loads to print a candidate tiling, packing pieces per bed. */
function tilingBedLoads(
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

interface MinPieceCandidate {
  colSizes: number[];
  rowSizes: number[];
  pieceCount: number;
  variance: number;
}

interface TilingCandidate {
  colSizes: number[];
  rowSizes: number[];
  pieceCount: number;
  cost: number;
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
function findOptimalTiling(
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
function computePaddingReductionHint(
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

/** Which sides detach into rails: padding ≥ threshold and the flag is on. */
function detachedSides(params: ResolvedBaseplateParams): {
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

type CornerRadii = { tl: number; tr: number; bl: number; br: number };

/**
 * Per-corner radii with the body's detached-side corners squared off — the rail
 * carries the rounded outer corner, so the body must butt flat against it rather
 * than rounding the same corner itself (which would double-round / leave the body
 * curving away from the rail). A corner squares when either adjacent side detaches.
 */
function squaredBodyCornerRadii(
  params: ResolvedBaseplateParams,
  det: { left: boolean; right: boolean; front: boolean; back: boolean }
): CornerRadii {
  const base = (corner: keyof CornerRadii): number =>
    params.cornerRadii?.[corner] ?? params.cornerRadius ?? GRIDFINITY.SOCKET_CORNER_RADIUS;
  return {
    tl: det.left || det.back ? 0 : base('tl'),
    tr: det.right || det.back ? 0 : base('tr'),
    bl: det.left || det.front ? 0 : base('bl'),
    br: det.right || det.front ? 0 : base('br'),
  };
}

/**
 * Body generation params with detached sides' padding zeroed — the body prints
 * padding-free wherever a rail carries that margin. Sub-threshold sides keep
 * their padding (they stay integral). Detached-side corners are squared so the
 * body butts flat against the rail's rounded corner. Must be applied to the BODY
 * mesh only, AFTER `computeBaseplateTiling`/`emitMargins` (which need the true
 * padding).
 */
export function bodyParamsForDetach(params: ResolvedBaseplateParams): ResolvedBaseplateParams {
  if (!params.detachMargins) return params;
  const det = detachedSides(params);
  if (!det.left && !det.right && !det.front && !det.back) return params;
  return {
    ...params,
    paddingLeft: det.left ? 0 : params.paddingLeft,
    paddingRight: det.right ? 0 : params.paddingRight,
    paddingFront: det.front ? 0 : params.paddingFront,
    paddingBack: det.back ? 0 : params.paddingBack,
    cornerRadii: squaredBodyCornerRadii(params, det),
  };
}

interface MarginLayout {
  readonly colSizes: readonly number[];
  readonly rowSizes: readonly number[];
  readonly colOffsets: readonly number[];
  readonly rowOffsets: readonly number[];
}

/**
 * Decompose the drawer-fit padding into detached printable rail segments — one
 * per outer body piece per detached side.
 *
 * Splitting per body piece means each segment is no longer than its piece (so it
 * fits the bed, since the planner already reserved padding budget when sizing
 * pieces), and lets the preview explode each segment in lockstep with its piece
 * instead of leaving a single long rail overlapping the spread-apart plate.
 *
 * Butt-joint frame: one axis pair runs `long` (its end segments own the plate
 * corners, extending over any perpendicular padding so they reach the true outer
 * corner); the perpendicular pair runs `short`, fitting between — and a short
 * end segment claims a corner only when its perpendicular long side is absent.
 * A side detaches only when its padding ≥ {@link MARGIN_MIN_DETACH_MM}.
 *
 * World positions are in the plate-centered, padding-free body frame (mm) so they
 * line up with how the preview/export place the body pieces.
 */
function emitMargins(params: ResolvedBaseplateParams, layout: MarginLayout): MarginPiece[] {
  if (!params.detachMargins) return [];
  const det = detachedSides(params);
  if (!det.left && !det.right && !det.front && !det.back) return [];

  const {
    paddingLeft: pl,
    paddingRight: pr,
    paddingFront: pf,
    paddingBack: pb,
    gridUnitMm,
    fractionalEdgeX,
    fractionalEdgeY,
  } = params;
  const gridUnitMmY = params.gridUnitMmY ?? gridUnitMm;
  const { colSizes, rowSizes, colOffsets, rowOffsets } = layout;
  const halfW = (params.width * gridUnitMm) / 2;
  const halfD = (params.depth * gridUnitMmY) / 2;
  const colLast = colSizes.length - 1;
  const rowLast = rowSizes.length - 1;
  const fill = {
    overTile: !!params.overTile,
    overTileHalfGrid: !!params.overTileHalfGrid,
    overTileHalfGridSolidLeftover: !!params.overTileHalfGridSolidLeftover,
  };
  // Piece-center in the padding-free body frame (matches SplitBaseplateMeshes).
  const colCenter = (c: number): number =>
    colOffsets[c] * gridUnitMm + (colSizes[c] * gridUnitMm) / 2 - halfW;
  const rowCenter = (r: number): number =>
    rowOffsets[r] * gridUnitMmY + (rowSizes[r] * gridUnitMmY) / 2 - halfD;

  const margins: MarginPiece[] = [];
  const push = (
    id: string,
    side: MarginPiece['side'],
    role: MarginPiece['role'],
    col: number,
    row: number,
    lengthMm: number,
    bandThicknessMm: number,
    ownedCorners: MarginCorner[],
    worldOffsetMm: { x: number; y: number },
    seamConnector?: MarginPiece['seamConnector']
  ): void => {
    margins.push({
      id,
      side,
      role,
      col,
      row,
      lengthMm,
      bandThicknessMm,
      ownedCorners,
      worldOffsetMm,
      seamConnector,
      ...fill,
    });
  };
  // Seam-connector layout for a long rail: the mating body wall's grid width and
  // its center offset from the rail center (nonzero on corner-owning end segments
  // that extend over the perpendicular padding). See MarginPiece.seamConnector.
  const seamFor = (
    cellUnits: number,
    centerOffsetMm: number,
    frac: 'start' | 'end'
  ): MarginPiece['seamConnector'] => ({
    cellUnits,
    centerOffsetMm,
    fractionalEdge: isFractional(cellUnits) ? frac : 'end',
  });

  // Prefer front/back as the long (corner-owning) axis; fall back to left/right
  // when neither front nor back detaches.
  const longAxisX = det.front || det.back;

  if (longAxisX) {
    // Front/back run long, segmented per column. End columns extend over the
    // left/right padding to reach the true outer corners (the long rail sits
    // outside the grid in Y while the body's left/right padding sits inside it,
    // so they abut without overlap).
    for (let c = 0; c <= colLast; c++) {
      const extL = c === 0 ? pl : 0;
      const extR = c === colLast ? pr : 0;
      const len = colSizes[c] * gridUnitMm + extL + extR;
      const cx = colCenter(c) - extL / 2 + extR / 2;
      // The connectors track the body wall's grid cells, centered on the piece's
      // grid center — which the corner-extended rail center no longer coincides
      // with, so record that shift for the rail to re-anchor its grooves.
      const seam = seamFor(colSizes[c], colCenter(c) - cx, fractionalEdgeX);
      if (det.front) {
        const owned: MarginCorner[] = [];
        if (c === 0) owned.push('bl');
        if (c === colLast) owned.push('br');
        push(
          `margin-front-${colToLetter(c)}`,
          'front',
          'long',
          c,
          0,
          len,
          pf,
          owned,
          { x: cx, y: -halfD - pf / 2 },
          seam
        );
      }
      if (det.back) {
        const owned: MarginCorner[] = [];
        if (c === 0) owned.push('tl');
        if (c === colLast) owned.push('tr');
        push(
          `margin-back-${colToLetter(c)}`,
          'back',
          'long',
          c,
          rowLast,
          len,
          pb,
          owned,
          { x: cx, y: halfD + pb / 2 },
          seam
        );
      }
    }
    // Short left/right rails, segmented per row, fit between the long rails but
    // extend over a perpendicular side's padding when that side is NOT a long
    // rail (integral or zero), claiming the corner there.
    for (let r = 0; r <= rowLast; r++) {
      const extF = !det.front && r === 0 ? pf : 0;
      const extB = !det.back && r === rowLast ? pb : 0;
      const len = rowSizes[r] * gridUnitMmY + extF + extB;
      const cy = rowCenter(r) - extF / 2 + extB / 2;
      if (det.left) {
        const owned: MarginCorner[] = [];
        if (!det.front && r === 0) owned.push('bl');
        if (!det.back && r === rowLast) owned.push('tl');
        push(`margin-left-${r + 1}`, 'left', 'short', 0, r, len, pl, owned, {
          x: -halfW - pl / 2,
          y: cy,
        });
      }
      if (det.right) {
        const owned: MarginCorner[] = [];
        if (!det.front && r === 0) owned.push('br');
        if (!det.back && r === rowLast) owned.push('tr');
        push(`margin-right-${r + 1}`, 'right', 'short', colLast, r, len, pr, owned, {
          x: halfW + pr / 2,
          y: cy,
        });
      }
    }
  } else {
    // Only left/right detach: they run long, segmented per row, over the full
    // outer depth (front/back padding is integral or zero here), owning all
    // corners on their side.
    for (let r = 0; r <= rowLast; r++) {
      const extF = r === 0 ? pf : 0;
      const extB = r === rowLast ? pb : 0;
      const len = rowSizes[r] * gridUnitMmY + extF + extB;
      const cy = rowCenter(r) - extF / 2 + extB / 2;
      const seam = seamFor(rowSizes[r], rowCenter(r) - cy, fractionalEdgeY);
      if (det.left) {
        const owned: MarginCorner[] = [];
        if (r === 0) owned.push('bl');
        if (r === rowLast) owned.push('tl');
        push(
          `margin-left-${r + 1}`,
          'left',
          'long',
          0,
          r,
          len,
          pl,
          owned,
          { x: -halfW - pl / 2, y: cy },
          seam
        );
      }
      if (det.right) {
        const owned: MarginCorner[] = [];
        if (r === 0) owned.push('br');
        if (r === rowLast) owned.push('tr');
        push(
          `margin-right-${r + 1}`,
          'right',
          'long',
          colLast,
          r,
          len,
          pr,
          owned,
          { x: halfW + pr / 2, y: cy },
          seam
        );
      }
    }
  }

  return margins;
}

/**
 * Compute the full 2D tiling for a baseplate.
 *
 * Takes the full generation params + print bed size and returns a tiling plan.
 * If the baseplate fits on a single bed, returns a single-piece tiling with
 * `isSplit: false`.
 */
export function computeBaseplateTiling(
  params: ResolvedBaseplateParams,
  printBedWidthMm: number,
  printBedDepthMm: number = printBedWidthMm
): BaseplateTiling {
  const {
    width,
    depth,
    gridUnitMm,
    paddingLeft,
    paddingRight,
    paddingFront,
    paddingBack,
    fractionalEdgeX,
    fractionalEdgeY,
    connectorNubs,
    invertDovetails,
    preferIdenticalPieces,
  } = params;
  // preferIdenticalPieces only takes effect when connectors are enabled — the
  // UI checkbox is hidden under that gate, but the stored flag persists, so
  // gate here too to keep behavior aligned with the visible control.
  const palindromic = !!preferIdenticalPieces && !!connectorNubs;

  // Pieces with dovetail connectors include male tongue protrusions in their bbox
  //. The planner reserves bed budget for those tongues so the resulting
  // STLs actually fit the bed.
  const gridUnitMmY = params.gridUnitMmY ?? gridUnitMm;
  // The outermost pieces print wider than their grid units by the outline
  // overhang, so the bed budget must reserve for it exactly as it does
  // for exterior padding — otherwise the search happily sizes an outer chunk to
  // the bed and the generator then widens it past the bed.
  const oh = params.outlineOverhang;
  const xAxis = makeAxisConfig(
    printBedWidthMm,
    gridUnitMm,
    paddingLeft,
    paddingRight,
    connectorNubs,
    invertDovetails,
    palindromic,
    oh?.left ?? 0,
    oh?.right ?? 0
  );
  const yAxis = makeAxisConfig(
    printBedDepthMm,
    gridUnitMmY,
    paddingFront,
    paddingBack,
    connectorNubs,
    invertDovetails,
    palindromic,
    oh?.front ?? 0,
    oh?.back ?? 0
  );

  // A user-drawn plan replaces the search outright. It is NOT reordered:
  // `reorderForDisplay` exists to prettify search output, and applying it here
  // would slide hand-placed seams to different offsets than the ones drawn.
  // `buildFullParams` has already dropped a plan that no longer matches
  // width/depth, so anything present here is consistent with the plate.
  const override = params.splitOverride;
  const isCustomSplit = override !== undefined;

  let colSizes: number[];
  let rowSizes: number[];
  if (override !== undefined) {
    colSizes = [...override.cols];
    rowSizes = [...override.rows];
  } else {
    const { colSizes: rawColSizes, rowSizes: rawRowSizes } = findOptimalTiling(
      width,
      depth,
      xAxis,
      yAxis
    );

    // Reorder for display: largest pieces at front/left, fractional edges pinned.
    // Under preferIdenticalPieces, arrange palindromically so outer positions match.
    colSizes = reorderForDisplay(
      rawColSizes,
      axisCapacity(xAxis),
      fractionalEdgeX === 'start',
      palindromic
    );
    rowSizes = reorderForDisplay(
      rawRowSizes,
      axisCapacity(yAxis),
      fractionalEdgeY === 'start',
      palindromic
    );
  }

  // Recompute on the FINAL (reordered) sizes: reordering can move a chunk
  // between an edge position (padding overhead) and a middle one (tongue only),
  // which shifts a piece's physical footprint — so the search-time count isn't
  // guaranteed to match the tiling actually emitted.
  const bedLoads = tilingBedLoads(colSizes, rowSizes, xAxis, yAxis);

  const isSplit = colSizes.length > 1 || rowSizes.length > 1;
  const colOffsets = cumulativeOffsets(colSizes);
  const rowOffsets = cumulativeOffsets(rowSizes);

  const lastCol = colSizes.length - 1;
  const lastRow = rowSizes.length - 1;

  // Detached sides print padding-free on the body pieces too — the rail carries
  // that margin. Sub-threshold sides stay integral.
  const det = detachedSides(params);

  // The opt-in connector marks the body↔long-rail seam so the connector
  // builder adds a tongue there — or, under `dovetailKey`, a female groove that
  // the seated key spans. Scoped to the LONG rails only (short rails stay
  // friction-fit); snapClip stays out, as its top-insert clip has no seated form
  // at a body↔rail seam. `longAxisX` mirrors `emitMargins`: front/back are the
  // long rails, else left/right.
  //
  // NOTE: the seam tongue protrudes TONGUE_PROTRUSION (1.5mm) past the body's
  // detached edge, which `axisChunkMm` doesn't yet budget against the bed. Only
  // matters when a SPLIT body chunk sits within 1.5mm of the bed on a detached
  // seam side — a rare compound case. Precise per-side seam budgeting is a
  // follow-up; deferred to avoid destabilizing the split math for all plates.
  const seamOn =
    params.detachMargins === true &&
    params.detachMarginConnector === true &&
    isMarginSeamStyle(params.connectorStyle);
  const longAxisX = det.front || det.back;
  const seam = {
    left: seamOn && det.left && !longAxisX,
    right: seamOn && det.right && !longAxisX,
    front: seamOn && det.front && longAxisX,
    back: seamOn && det.back && longAxisX,
  };
  const edgeKind = (isEdge: boolean, isSeam: boolean): BaseplateEdgeKind =>
    !isEdge ? 'join' : isSeam ? 'marginSeam' : 'exterior';

  const pieces: BaseplatePiece[] = [];

  for (let r = 0; r < rowSizes.length; r++) {
    for (let c = 0; c < colSizes.length; c++) {
      const isLeftEdge = c === 0;
      const isRightEdge = c === lastCol;
      const isFrontEdge = r === 0;
      const isBackEdge = r === lastRow;

      const actualEdges: PieceEdges = {
        left: edgeKind(isLeftEdge, seam.left),
        right: edgeKind(isRightEdge, seam.right),
        front: edgeKind(isFrontEdge, seam.front),
        back: edgeKind(isBackEdge, seam.back),
      };
      // Under preferIdenticalPieces, the piece's mesh is generated from a
      // canonical edge layout (lex-smaller of {edges, 180°-rotated edges}).
      // If the actual edges differ, the placement applies a 180° rotation so
      // the dovetails end up on the correct world-space sides.
      const needs180 = palindromic && edgeKey(actualEdges) > edgeKey(rotateEdges180(actualEdges));

      pieces.push({
        label: `${colToLetter(c)}${r + 1}`,
        col: c,
        row: r,
        widthUnits: colSizes[c],
        depthUnits: rowSizes[r],
        gridOffsetX: colOffsets[c],
        gridOffsetY: rowOffsets[r],
        paddingLeft: isLeftEdge && !det.left ? paddingLeft : 0,
        paddingRight: isRightEdge && !det.right ? paddingRight : 0,
        paddingFront: isFrontEdge && !det.front ? paddingFront : 0,
        paddingBack: isBackEdge && !det.back ? paddingBack : 0,
        fractionalEdgeX: isFractional(colSizes[c]) ? fractionalEdgeX : 'none',
        fractionalEdgeY: isFractional(rowSizes[r]) ? fractionalEdgeY : 'none',
        edges: actualEdges,
        placementRotationDeg: needs180 ? 180 : 0,
      });
    }
  }

  const pieceCount = colSizes.length * rowSizes.length;
  // The hint is advice about the automatic plan ("reduce padding and the
  // planner saves you N pieces"), which is meaningless once the user has
  // overridden that plan — their piece count is their own choice.
  const paddingReductionHint = isCustomSplit
    ? null
    : computePaddingReductionHint(width, depth, xAxis, yAxis, pieceCount);

  const tiling: BaseplateTiling = {
    isSplit,
    pieces,
    margins: emitMargins(params, { colSizes, rowSizes, colOffsets, rowOffsets }),
    cols: colSizes.length,
    rows: rowSizes.length,
    colSizes,
    rowSizes,
    totalWidthUnits: width,
    totalDepthUnits: depth,
    bedLoads,
    stackCount: 1,
    stackSeparatorThickness: 0,
    paddingReductionHint,
    isCustomSplit,
    bedOverages: [],
  };
  const shaped =
    params.outline !== undefined
      ? applyOutlineToTiling(tiling, params, printBedWidthMm, printBedDepthMm)
      : tiling;
  return {
    ...shaped,
    // Computed on the shaped tiling so dropped pieces don't raise a warning
    // about geometry that isn't printed.
    bedOverages: computeBedOverages(shaped.pieces, colSizes, rowSizes, xAxis, yAxis),
  };
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
function computeBedOverages(
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

/**
 * Shape a rectangular tiling with the plate outline:
 *
 * - pieces whose window is fully OUTSIDE are dropped (their grid labels stay
 *   positional, so gaps like "A1, A3" read as the shape in the print guide);
 * - fully-INSIDE pieces stay pure rectangles — no outline on their params, so
 *   fingerprints, dedup, and connectors behave exactly as on unshaped plates;
 * - PARTIAL pieces are tagged with their window origin; their generation
 *   params get a piece-local outline and the 3D intersect performs the window
 *   clip (the piece slab IS the window).
 *
 * Seams keep connectors only when FULL: the one-grid-unit band on each side
 * of the whole shared span must be fully inside. Partial seams (and seams to
 * dropped neighbors) become plain butt joints — both facing edges 'exterior'.
 *
 * `placementRotationDeg` follows the same palindromic rule the rectangular path
 * uses, but computed from the RECLASSIFIED edges (partial/dropped seams demote
 * some joins to exterior first). On a point-symmetric outline this lets opposite
 * corner tiles (TL↔BR, TR↔BL) share one canonical mesh placed rotated 180° —
 * their piece-local outlines are 180° rotations of each other, which the
 * cyclic-start-canonical outline hash (see pieceFingerprint) collapses to one
 * fingerprint. `placementRotationDeg` follows the edge layout, not the outline,
 * so a non-symmetric piece may still be placed at 180 — but its rotated outline
 * differs from any partner's, so the fingerprints diverge and it never shares a
 * tower (it stays in its own group; the rotation only affects placement).
 *
 * The outline is plate-local mm over the padded extent (corner-cut shapes
 * compose with padding), so windows are the pieces' padded slab extents:
 * the grid sits offset by the left/front padding, and first/last pieces
 * carry their exterior padding.
 */
function applyOutlineToTiling(
  tiling: BaseplateTiling,
  params: ResolvedBaseplateParams,
  printBedWidthMm: number,
  printBedDepthMm: number
): BaseplateTiling {
  const outline = params.outline as DrawerOutline;
  const u = params.gridUnitMm;
  const uy = params.gridUnitMmY ?? u;
  const padL = params.paddingLeft;
  const padF = params.paddingFront;

  // The piece slab IS the clip window, so the window spans the piece's full
  // padded extent — a corner piece whose grid cells are all outside can still
  // survive as the padding material the arc leaves behind.
  //
  // The outermost pieces additionally absorb the outline's overhang:
  // a grid-shifted perimeter reaches past `[0, totalW]`, and windows that
  // stopped at the nominal extent left that strip in no piece at all — it
  // vanished from the split export exactly as it did from the whole plate.
  // Interior pieces are untouched, so seams stay where they were.
  const oh = params.outlineOverhang;
  const edgesOf = (
    piece: BaseplatePiece
  ): { left: number; right: number; front: number; back: number } => ({
    left: piece.gridOffsetX === 0 ? (oh?.left ?? 0) : 0,
    right: piece.gridOffsetX + piece.widthUnits === tiling.totalWidthUnits ? (oh?.right ?? 0) : 0,
    front: piece.gridOffsetY === 0 ? (oh?.front ?? 0) : 0,
    back: piece.gridOffsetY + piece.depthUnits === tiling.totalDepthUnits ? (oh?.back ?? 0) : 0,
  });
  // Origin of the piece's NOMINAL padded extent — the overhang is deliberately
  // excluded. A piece frames its outline exactly as the whole plate
  // does: the padded extent starts at 0 and the slab grows outward into
  // negative coordinates. Subtracting the overhang here instead would land the
  // perimeter that far inside its own slab, truncating the outer strip and
  // displacing the shape against the piece's sockets — and only on the pieces
  // that carry an outer overhang, which is what made it read as asymmetric.
  const originOf = (piece: BaseplatePiece): { x: number; y: number } => ({
    x: padL + piece.gridOffsetX * u - piece.paddingLeft,
    y: padF + piece.gridOffsetY * uy - piece.paddingFront,
  });
  const windowOf = (piece: BaseplatePiece): { x0: number; y0: number; x1: number; y1: number } => {
    const e = edgesOf(piece);
    const origin = originOf(piece);
    return {
      x0: origin.x - e.left,
      y0: origin.y - e.front,
      x1: padL + (piece.gridOffsetX + piece.widthUnits) * u + piece.paddingRight + e.right,
      y1: padF + (piece.gridOffsetY + piece.depthUnits) * uy + piece.paddingBack + e.back,
    };
  };

  const classByKey = new Map<string, RegionClass>();
  for (const piece of tiling.pieces) {
    const w = windowOf(piece);
    classByKey.set(`${piece.col},${piece.row}`, classifyRect(outline, w.x0, w.y0, w.x1, w.y1));
  }
  const classAt = (col: number, row: number): RegionClass =>
    classByKey.get(`${col},${row}`) ?? 'outside';

  // Per-junction connector gating. A junction keeps its connector when
  // the one-cell band on BOTH sides of its along-seam cell pair is fully
  // inside the outline — the same insideness rule the old whole-span check
  // used, but applied per cell boundary instead of all-or-nothing: a seam that
  // merely grazes the shaped boundary used to lose every connector along it.
  // Windows are pure GRID extents (seams are interior, padding-free), offset
  // into plate-local mm.
  //
  // Returns 'all' (every junction inside → no filter, byte-stable with
  // unshaped plates), 'none' (no junction survives → the seam demotes to
  // exterior, as before), or the allowed subset in piece-centered mm along
  // the seam's boundary axis — the exact coordinate `buildConnectors` and
  // `computeSeamJunctions` place connectors at.
  const seamGate = (
    piece: BaseplatePiece,
    side: 'left' | 'right' | 'front' | 'back'
  ): 'all' | 'none' | number[] => {
    const gx0 = padL + piece.gridOffsetX * u;
    const gx1 = padL + (piece.gridOffsetX + piece.widthUnits) * u;
    const gy0 = padF + piece.gridOffsetY * uy;
    const gy1 = padF + (piece.gridOffsetY + piece.depthUnits) * uy;
    const vertical = side === 'left' || side === 'right';
    const alongPitch = vertical ? uy : u;
    const offsets = vertical
      ? interiorBoundaryOffsetsMm(piece.depthUnits, uy, piece.fractionalEdgeY)
      : interiorBoundaryOffsetsMm(piece.widthUnits, u, piece.fractionalEdgeX);
    // A 1-cell span has no junctions, so there is nothing to gate — the seam
    // stays a friction-fit butt joint exactly like its unshaped counterpart.
    if (offsets.length === 0) return 'all';

    const seam = vertical ? (side === 'left' ? gx0 : gx1) : side === 'front' ? gy0 : gy1;
    const centerAlong = vertical ? (gy0 + gy1) / 2 : (gx0 + gx1) / 2;
    const allowed = offsets.filter((off) => {
      const lo = centerAlong + off - alongPitch / 2;
      const hi = centerAlong + off + alongPitch / 2;
      return vertical
        ? classifyRect(outline, seam - u, lo, seam, hi) === 'inside' &&
            classifyRect(outline, seam, lo, seam + u, hi) === 'inside'
        : classifyRect(outline, lo, seam - uy, hi, seam) === 'inside' &&
            classifyRect(outline, lo, seam, hi, seam + uy) === 'inside';
    });
    if (allowed.length === 0) return 'none';
    if (allowed.length === offsets.length) return 'all';
    return allowed;
  };

  const NEIGHBOR: Record<'left' | 'right' | 'front' | 'back', readonly [number, number]> = {
    left: [-1, 0],
    right: [1, 0],
    front: [0, -1],
    back: [0, 1],
  };

  // Mirrors computeBaseplateTiling: preferIdenticalPieces only engages when
  // connectors are on (the UI checkbox is hidden otherwise, but the flag persists).
  const palindromic = !!params.preferIdenticalPieces && !!params.connectorNubs;

  const survivors: BaseplatePiece[] = [];
  for (const piece of tiling.pieces) {
    const cls = classAt(piece.col, piece.row);
    if (cls === 'outside') continue;

    const edges = { ...piece.edges };
    const filter: Partial<Record<'left' | 'right' | 'front' | 'back', number[]>> = {};
    let hasFilter = false;
    for (const side of ['left', 'right', 'front', 'back'] as const) {
      if (edges[side] !== 'join') continue;
      const [dc, dr] = NEIGHBOR[side];
      if (classAt(piece.col + dc, piece.row + dr) === 'outside') {
        edges[side] = 'exterior';
        continue;
      }
      const gate = seamGate(piece, side);
      if (gate === 'none') {
        edges[side] = 'exterior';
      } else if (gate !== 'all') {
        filter[side] = gate;
        hasFilter = true;
      }
    }

    // Canonicalize from the RECLASSIFIED edges: the 180° share only applies once
    // partial/dropped seams have demoted their joins to exterior.
    const needs180 = palindromic && edgeKey(edges) > edgeKey(rotateEdges180(edges));

    survivors.push({
      ...piece,
      edges,
      placementRotationDeg: needs180 ? 180 : 0,
      ...(cls === 'partial' ? { outlineWindowOriginMm: originOf(piece) } : {}),
      ...(hasFilter ? { connectorFilter: filter } : {}),
    });
  }

  // Bed-load footprints budget the male tongue protrusion on surviving join
  // edges, mirroring the axis search's own bed math — otherwise a piece whose
  // tongues push it past the bed would undercount loads.
  const tongue = params.connectorNubs === true ? TONGUE_PROTRUSION : 0;
  const bedLoads = estimateBedLoads(
    survivors.map((piece) => ({
      w:
        piece.widthUnits * u +
        (piece.edges.left === 'join' ? tongue : 0) +
        (piece.edges.right === 'join' ? tongue : 0),
      d:
        piece.depthUnits * u +
        (piece.edges.front === 'join' ? tongue : 0) +
        (piece.edges.back === 'join' ? tongue : 0),
    })),
    printBedWidthMm,
    printBedDepthMm
  );

  return {
    ...tiling,
    isSplit: survivors.length > 1,
    pieces: survivors,
    bedLoads: Math.max(1, bedLoads),
    paddingReductionHint: null,
  };
}

/**
 * Convert a tiling piece into full baseplate generation params.
 *
 * Inherits magnet and grid settings from the parent params,
 * but overrides dimensions and padding for this specific piece.
 */
export function pieceToBaseplateParams(
  piece: BaseplatePiece,
  parentParams: ResolvedBaseplateParams
): ResolvedBaseplateParams {
  // Default fractionalEdge to 'end' when this piece has no fraction.
  const fracX: 'start' | 'end' = piece.fractionalEdgeX === 'none' ? 'end' : piece.fractionalEdgeX;
  const fracY: 'start' | 'end' = piece.fractionalEdgeY === 'none' ? 'end' : piece.fractionalEdgeY;

  // Under preferIdenticalPieces, generate from the canonical (180°-equivalent)
  // form and apply the rotation at placement so opposite-corner pieces share
  // one mesh. EVERY positionally-indexed field must rotate alongside edges:
  // padding (L↔R, F↔B), fractionalEdge (start↔end), per-corner radii (tl↔br,
  // tr↔bl — buildSlabProfile maps tl to left+back exterior and br to
  // right+front exterior, which the 180° rotation swaps).
  const rot = parentParams.preferIdenticalPieces && piece.placementRotationDeg === 180;
  // Only flip fractionalEdge when this piece actually has a fractional sliver
  // on that axis. Non-fractional pieces default to 'end' regardless of
  // orientation — flipping them would diverge from their canonical-pair
  // partner's fingerprint without changing any geometry.
  const flipX = rot && piece.fractionalEdgeX !== 'none';
  const flipY = rot && piece.fractionalEdgeY !== 'none';
  const pr = parentParams.cornerRadii;
  // When detaching, square this piece's corners that sit on a detached exterior
  // edge — the rail carries that rounded outer corner, so the body butts flat.
  // Built in the actual orientation, then rotated alongside `edges` under rot.
  let cornerRadii: CornerRadii | undefined;
  if (parentParams.detachMargins) {
    const det = detachedSides(parentParams);
    const e = piece.edges;
    const baseR = (corner: keyof CornerRadii): number =>
      pr?.[corner] ?? parentParams.cornerRadius ?? GRIDFINITY.SOCKET_CORNER_RADIUS;
    const actual: CornerRadii = {
      tl:
        (isExteriorEdge(e.left) && det.left) || (isExteriorEdge(e.back) && det.back)
          ? 0
          : baseR('tl'),
      tr:
        (isExteriorEdge(e.right) && det.right) || (isExteriorEdge(e.back) && det.back)
          ? 0
          : baseR('tr'),
      bl:
        (isExteriorEdge(e.left) && det.left) || (isExteriorEdge(e.front) && det.front)
          ? 0
          : baseR('bl'),
      br:
        (isExteriorEdge(e.right) && det.right) || (isExteriorEdge(e.front) && det.front)
          ? 0
          : baseR('br'),
    };
    cornerRadii = rot ? { tl: actual.br, tr: actual.bl, bl: actual.tr, br: actual.tl } : actual;
  } else {
    cornerRadii = rot && pr ? { tl: pr.br, tr: pr.bl, bl: pr.tr, br: pr.tl } : pr;
  }
  // Partial pieces get the plate outline translated into their local frame —
  // origin at the piece's padded extent, so an overhang stays negative exactly
  // as it does on the whole plate. The generator's 3D intersect
  // performs the window clip (the piece slab IS the window, and it is what the
  // overhang widens), so no 2D clipping is needed here. Fully-inside pieces carry
  // no outline and stay byte-identical to unshaped rectangles. Under `rot` the
  // outline is the ONLY positional field not yet rotated (padding/edges/
  // fractionalEdge/cornerRadii already are), so rotate it 180° about the window
  // center. Window extents are rotation-invariant per-axis sums, so they need no
  // swap. On a point-symmetric outline this lands the rotated partner's local
  // outline exactly on its canonical mate's (see the cyclic-start fingerprint).
  const pieceOutline = ((): ResolvedBaseplateParams['outline'] => {
    if (parentParams.outline === undefined || piece.outlineWindowOriginMm === undefined) {
      return undefined;
    }
    const local = translateOutline(
      parentParams.outline,
      -piece.outlineWindowOriginMm.x,
      -piece.outlineWindowOriginMm.y
    );
    if (!rot) return local;
    const windowW =
      piece.widthUnits * parentParams.gridUnitMm + piece.paddingLeft + piece.paddingRight;
    const windowD =
      piece.depthUnits * (parentParams.gridUnitMmY ?? parentParams.gridUnitMm) +
      piece.paddingFront +
      piece.paddingBack;
    return rotateOutline180(local, windowW, windowD);
  })();

  // The outermost pieces inherit the parent's outline overhang on their outer
  // sides only, matching the widened windows `applyOutlineToTiling`
  // classified them against — without it the piece's slab stops at the nominal
  // extent and clips the very strip the window was widened to keep. Interior
  // sides stay 0 so seams and interior pieces are byte-identical. Positional
  // like padding, so it swaps under `rot`.
  const pieceOverhang = ((): ResolvedBaseplateParams['outlineOverhang'] => {
    const oh = parentParams.outlineOverhang;
    if (oh === undefined) return undefined;
    const actual = {
      left: piece.gridOffsetX === 0 ? oh.left : 0,
      right: piece.gridOffsetX + piece.widthUnits === parentParams.width ? oh.right : 0,
      front: piece.gridOffsetY === 0 ? oh.front : 0,
      back: piece.gridOffsetY + piece.depthUnits === parentParams.depth ? oh.back : 0,
    };
    if (actual.left === 0 && actual.right === 0 && actual.front === 0 && actual.back === 0) {
      return undefined;
    }
    return rot
      ? { left: actual.right, right: actual.left, front: actual.back, back: actual.front }
      : actual;
  })();

  // Like the outline, the connector filter is positional: under `rot` the
  // sides swap (L↔R, F↔B) and the piece-centered along-seam offsets negate
  // (a 180° turn about the center). Sorted so equal gatings hash equal.
  const connectorFilter = ((): ConnectorBoundaryFilter | undefined => {
    const f = piece.connectorFilter;
    if (f === undefined) return undefined;
    if (!rot) return f;
    const neg = (a: readonly number[]): number[] => a.map((v) => -v).sort((x, y) => x - y);
    return {
      ...(f.right !== undefined ? { left: neg(f.right) } : {}),
      ...(f.left !== undefined ? { right: neg(f.left) } : {}),
      ...(f.back !== undefined ? { front: neg(f.back) } : {}),
      ...(f.front !== undefined ? { back: neg(f.front) } : {}),
    };
  })();

  return {
    width: piece.widthUnits,
    depth: piece.depthUnits,
    gridUnitMm: parentParams.gridUnitMm,
    // A piece is only ever rotated 180° (preferIdenticalPieces), which preserves
    // axis identity, so the parent's X/Y pitch carries straight through.
    gridUnitMmY: parentParams.gridUnitMmY,
    outline: pieceOutline,
    outlineOverhang: pieceOverhang,
    connectorFilter,
    magnetHoles: parentParams.magnetHoles,
    magnetDiameter: parentParams.magnetDiameter,
    magnetDepth: parentParams.magnetDepth,
    paddingLeft: rot ? piece.paddingRight : piece.paddingLeft,
    paddingRight: rot ? piece.paddingLeft : piece.paddingRight,
    paddingFront: rot ? piece.paddingBack : piece.paddingFront,
    paddingBack: rot ? piece.paddingFront : piece.paddingBack,
    fractionalEdgeX: flipX ? flip(fracX) : fracX,
    fractionalEdgeY: flipY ? flip(fracY) : fracY,
    edges: rot ? rotateEdges180(piece.edges) : piece.edges,
    // Over-tile is additive (clipped pockets in each piece's exterior padding
    // margin) and leaves the slab/grid/offset unchanged, so it propagates to
    // pieces cleanly: interior join edges have zero padding → no pockets, and
    // exterior padded edges get the gap-filling tiles. Half-grid must ride along
    // too, or a split plate silently falls back to plain over-tile per piece.
    overTile: parentParams.overTile,
    overTileHalfGrid: parentParams.overTileHalfGrid,
    overTileHalfGridSolidLeftover: parentParams.overTileHalfGridSolidLeftover,
    // Rides along for the same reason half-grid does: without it a split shaped
    // plate falls back to sliced sockets on every piece.
    wholeCellsOnly: parentParams.wholeCellsOnly,
    connectorNubs: parentParams.connectorNubs,
    // Dovetail key seams are symmetric, so connectorStyle is rotation-invariant —
    // copy it straight through (unlike padding/edges, which rotate with `rot`).
    connectorStyle: parentParams.connectorStyle,
    // All-edge slots are symmetric across all four sides, so — like the
    // style — the flag is rotation-invariant. Which sides actually get a slot is
    // derived per-piece from the (already rotated) edges and padding.
    connectorSlotsAllEdges: parentParams.connectorSlotsAllEdges,
    // The fit offset and nozzle both size the female groove clearance
    // (effectiveClearance), so they must reach every split piece — otherwise the
    // groove is cut at nominal regardless of the user's tolerance.
    // Per-side clearance is symmetric, so both are rotation-invariant.
    connectorFitOffset: parentParams.connectorFitOffset,
    nozzleSizeMm: parentParams.nozzleSizeMm,
    invertDovetails: parentParams.invertDovetails,
    preferIdenticalPieces: parentParams.preferIdenticalPieces,
    lightweight: parentParams.lightweight,
    solidFloor: parentParams.solidFloor,
    solidFloorThickness: parentParams.solidFloorThickness,
    screwHoles: parentParams.screwHoles,
    // Inherited, never re-derived. Pieces of one plate share a slab height, so a
    // piece that computed its own pad would come out a different thickness from
    // its neighbours and the assembly would be stepped.
    screwPadThicknessMm: parentParams.screwPadThicknessMm,
    cornerRadius: parentParams.cornerRadius,
    cornerRadii,
  };
}

function flip(side: 'start' | 'end'): 'start' | 'end' {
  return side === 'start' ? 'end' : 'start';
}

/** Swap left↔right and front↔back, the edge layout under a 180° rotation. */
function rotateEdges180(edges: BaseplatePiece['edges']): BaseplatePiece['edges'] {
  return {
    left: edges.right,
    right: edges.left,
    front: edges.back,
    back: edges.front,
  };
}

function edgeKey(edges: BaseplatePiece['edges']): string {
  return `${edges.left}|${edges.right}|${edges.front}|${edges.back}`;
}

function cumulativeOffsets(sizes: number[]): number[] {
  const offsets: number[] = [0];
  for (let i = 1; i < sizes.length; i++) {
    offsets.push(offsets[i - 1] + sizes[i - 1]);
  }
  return offsets;
}
