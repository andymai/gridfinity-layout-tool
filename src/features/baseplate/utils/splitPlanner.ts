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

import type { BaseplateEdgeKind, ResolvedBaseplateParams } from '@/shared/types/bin';
import { isExteriorEdge, isSeamConnectorStyle } from '@/shared/types/bin';
// The fit checker subtracts the tongue protrusion from the bed budget on male
// join edges — otherwise pieces that compute to exactly the bed width on paper
// exceed it as STLs (#1498).
import { TONGUE_PROTRUSION } from '@/shared/constants/connectors';
import { MARGIN_MIN_DETACH_MM } from '@/core/constants';
import { GRIDFINITY } from '@/shared/constants/bin';
import type {
  BaseplatePiece,
  BaseplateTiling,
  MarginCorner,
  MarginPiece,
  PaddingReductionHint,
  PieceEdges,
} from '../types/tiling';
import { estimateBedLoads, type Footprint } from './bedPacking';
import type { DrawerOutline } from '@/core/types';
import { translateOutline } from '@/shared/utils/drawerOutline';
import { classifyRect, type RegionClass } from '@/shared/utils/drawerOutlineGeometry';
import { FRACTIONAL_THRESHOLD, isFractional, reorderForDisplay } from './splitReorder';

/**
 * Max extra pieces worth one saved build-plate load. Doubles as the bed-load
 * weight in the tiling cost (`LOAD_WEIGHT * bedLoads + pieceCount`): a finer
 * split that removes a load wins only if it adds fewer than this many pieces,
 * so the planner pursues fewer bed swaps without fragmenting into tiny tiles.
 */
const MAX_EXTRA_PIECES_PER_BED_LOAD = 4;

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
  readonly paddingStart: number;
  readonly paddingEnd: number;
  readonly startMaleMm: number;
  readonly endMaleMm: number;
}

function makeAxisConfig(
  bedMm: number,
  paddingStart: number,
  paddingEnd: number,
  connectorNubs: boolean | undefined,
  invertDovetails: boolean | undefined,
  preferIdenticalPieces: boolean | undefined
): AxisConfig {
  // Both axes follow the same rule: the start side (left / front) is male iff !invertDovetails.
  // Under preferIdenticalPieces, every join edge places a tongue+groove pair —
  // so both sides claim a tongue and the bed budget must reserve for both,
  // not just the conventionally-male side.
  const tongue = connectorNubs ? TONGUE_PROTRUSION : 0;
  const paired = !!preferIdenticalPieces && !!connectorNubs;
  if (paired) {
    return { bedMm, paddingStart, paddingEnd, startMaleMm: tongue, endMaleMm: tongue };
  }
  const startMale = !invertDovetails;
  return {
    bedMm,
    paddingStart,
    paddingEnd,
    startMaleMm: startMale ? tongue : 0,
    endMaleMm: startMale ? 0 : tongue,
  };
}

/**
 * Per-position max grid-unit capacity for a multi-chunk axis.
 * Multi-piece pieces give up bed-budget on each join edge whose tongue is male.
 * Middle chunks have both sides joined, but exactly one is male regardless of
 * invert orientation, so this collapses to a single TONGUE_PROTRUSION.
 */
function axisCapacity(
  gridUnitMm: number,
  axis: AxisConfig
): { maxFirst: number; maxLast: number; maxMiddle: number } {
  const { bedMm, paddingStart, paddingEnd, startMaleMm, endMaleMm } = axis;
  return {
    maxFirst: Math.floor((bedMm - paddingStart - endMaleMm) / gridUnitMm),
    maxLast: Math.floor((bedMm - paddingEnd - startMaleMm) / gridUnitMm),
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
function partitionAxis(
  totalUnits: number,
  numChunks: number,
  gridUnitMm: number,
  axis: AxisConfig
): number[] | null {
  const { bedMm, paddingStart, paddingEnd, startMaleMm } = axis;
  const intPart = Math.floor(totalUnits);
  const hasFrac = totalUnits - intPart >= FRACTIONAL_THRESHOLD;

  // Single-piece (numChunks=1) has no joins, so no tongue overhead.
  const maxWithBoth = Math.floor((bedMm - paddingStart - paddingEnd) / gridUnitMm);
  const { maxFirst, maxLast, maxMiddle } = axisCapacity(gridUnitMm, axis);

  // Degenerate: bed can't hold even 1 unit in any position
  if (maxWithBoth < 1 || maxFirst < 1 || maxLast < 1 || maxMiddle < 1) {
    return numChunks === 1 ? [totalUnits] : null;
  }

  if (numChunks === 1) {
    if (intPart > maxWithBoth) return null;
    if (hasFrac) {
      if ((intPart + 0.5) * gridUnitMm + paddingStart + paddingEnd <= bedMm) {
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
    const lastOverhead = paddingEnd + startMaleMm;
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
  gridUnitMm: number,
  xAxis: AxisConfig,
  yAxis: AxisConfig
): boolean {
  return chunkSizesFit(colSizes, gridUnitMm, xAxis) && chunkSizesFit(rowSizes, gridUnitMm, yAxis);
}

/**
 * Per-position physical size (mm) of each chunk on an axis — grid units plus
 * edge padding and join-edge tongue protrusion (matches the actual STL bounding
 * boxes). First/last chunks carry their exterior padding; join edges (interior
 * sides) carry a male tongue's protrusion when the convention assigns male to
 * that side, while female sides cut into the slab and add nothing.
 */
function axisChunkMm(sizes: number[], gridUnitMm: number, axis: AxisConfig): number[] {
  const last = sizes.length - 1;
  return sizes.map((s, i) => {
    const padStart = i === 0 ? axis.paddingStart : 0;
    const padEnd = i === last ? axis.paddingEnd : 0;
    const tongueStart = i === 0 ? 0 : axis.startMaleMm;
    const tongueEnd = i === last ? 0 : axis.endMaleMm;
    return s * gridUnitMm + padStart + padEnd + tongueStart + tongueEnd;
  });
}

function chunkSizesFit(sizes: number[], gridUnitMm: number, axis: AxisConfig): boolean {
  return axisChunkMm(sizes, gridUnitMm, axis).every((mm) => mm <= axis.bedMm + 0.001);
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
  gridUnitMm: number,
  xAxis: AxisConfig,
  yAxis: AxisConfig
): number {
  const colMm = axisChunkMm(colSizes, gridUnitMm, xAxis);
  const rowMm = axisChunkMm(rowSizes, gridUnitMm, yAxis);
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
  gridUnitMm: number,
  xAxis: AxisConfig,
  yAxis: AxisConfig
): MinPieceCandidate | null {
  const maxCols = Math.ceil(totalWidth);
  const maxRows = Math.ceil(totalDepth);
  let best: MinPieceCandidate | null = null;

  for (let nc = 1; nc <= maxCols; nc++) {
    if (best && nc > best.pieceCount) break;
    const colSizes = partitionAxis(totalWidth, nc, gridUnitMm, xAxis);
    if (!colSizes) continue;

    for (let nr = 1; nr <= maxRows; nr++) {
      const pieceCount = nc * nr;
      if (best && pieceCount > best.pieceCount) break;
      const rowSizes = partitionAxis(totalDepth, nr, gridUnitMm, yAxis);
      if (!rowSizes) continue;
      if (allPiecesFit(colSizes, rowSizes, gridUnitMm, xAxis, yAxis)) {
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
  gridUnitMm: number,
  xAxis: AxisConfig,
  yAxis: AxisConfig
): { colSizes: number[]; rowSizes: number[] } {
  const coarse = findMinPieceTiling(totalWidth, totalDepth, gridUnitMm, xAxis, yAxis);
  if (!coarse) {
    return { colSizes: [totalWidth], rowSizes: [totalDepth] };
  }

  const coarseBedLoads = tilingBedLoads(coarse.colSizes, coarse.rowSizes, gridUnitMm, xAxis, yAxis);

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

    const colSizes = partitionAxis(totalWidth, nc, gridUnitMm, xAxis);
    if (!colSizes) continue;

    for (let nr = 1; nr <= maxRows; nr++) {
      const pieceCount = nc * nr;
      // pieceCount keeps growing with nr; once even a 1-load split can't beat
      // best, no larger nr will either.
      if (pieceCount + MAX_EXTRA_PIECES_PER_BED_LOAD > best.cost) break;

      const rowSizes = partitionAxis(totalDepth, nr, gridUnitMm, yAxis);
      if (!rowSizes) continue;
      if (!allPiecesFit(colSizes, rowSizes, gridUnitMm, xAxis, yAxis)) continue;

      const bedLoads = tilingBedLoads(colSizes, rowSizes, gridUnitMm, xAxis, yAxis);
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
  gridUnitMm: number,
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
      const result = findOptimalTiling(totalWidth, totalDepth, gridUnitMm, x, y);
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
  const { colSizes, rowSizes, colOffsets, rowOffsets } = layout;
  const halfW = (params.width * gridUnitMm) / 2;
  const halfD = (params.depth * gridUnitMm) / 2;
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
    rowOffsets[r] * gridUnitMm + (rowSizes[r] * gridUnitMm) / 2 - halfD;

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
      // with, so record that shift for the rail to re-anchor its grooves (#2427).
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
      const len = rowSizes[r] * gridUnitMm + extF + extB;
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
      const len = rowSizes[r] * gridUnitMm + extF + extB;
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
  // (#1498). The planner reserves bed budget for those tongues so the resulting
  // STLs actually fit the bed.
  const xAxis = makeAxisConfig(
    printBedWidthMm,
    paddingLeft,
    paddingRight,
    connectorNubs,
    invertDovetails,
    palindromic
  );
  const yAxis = makeAxisConfig(
    printBedDepthMm,
    paddingFront,
    paddingBack,
    connectorNubs,
    invertDovetails,
    palindromic
  );

  const { colSizes: rawColSizes, rowSizes: rawRowSizes } = findOptimalTiling(
    width,
    depth,
    gridUnitMm,
    xAxis,
    yAxis
  );

  // Reorder for display: largest pieces at front/left, fractional edges pinned.
  // Under preferIdenticalPieces, arrange palindromically so outer positions match.
  const colSizes = reorderForDisplay(
    rawColSizes,
    axisCapacity(gridUnitMm, xAxis),
    fractionalEdgeX === 'start',
    palindromic
  );
  const rowSizes = reorderForDisplay(
    rawRowSizes,
    axisCapacity(gridUnitMm, yAxis),
    fractionalEdgeY === 'start',
    palindromic
  );

  // Recompute on the FINAL (reordered) sizes: reordering can move a chunk
  // between an edge position (padding overhead) and a middle one (tongue only),
  // which shifts a piece's physical footprint — so the search-time count isn't
  // guaranteed to match the tiling actually emitted.
  const bedLoads = tilingBedLoads(colSizes, rowSizes, gridUnitMm, xAxis, yAxis);

  const isSplit = colSizes.length > 1 || rowSizes.length > 1;
  const colOffsets = cumulativeOffsets(colSizes);
  const rowOffsets = cumulativeOffsets(rowSizes);

  const lastCol = colSizes.length - 1;
  const lastRow = rowSizes.length - 1;

  // Detached sides print padding-free on the body pieces too — the rail carries
  // that margin. Sub-threshold sides stay integral.
  const det = detachedSides(params);

  // The opt-in connector (#2414) marks the body↔long-rail seam so the connector
  // builder adds a tongue there. Scoped to the LONG rails only (short rails stay
  // friction-fit) and to the tongue/groove styles — snapClip seams would need a
  // separate clip part, which `marginSeam` must not emit. `longAxisX` mirrors
  // `emitMargins`: front/back are the long rails, else left/right.
  //
  // NOTE: the seam tongue protrudes TONGUE_PROTRUSION (1.5mm) past the body's
  // detached edge, which `axisChunkMm` doesn't yet budget against the bed. Only
  // matters when a SPLIT body chunk sits within 1.5mm of the bed on a detached
  // seam side — a rare compound case. Precise per-side seam budgeting is a
  // follow-up; deferred to avoid destabilizing the split math for all plates.
  const seamOn =
    params.detachMargins === true &&
    params.detachMarginConnector === true &&
    isSeamConnectorStyle(params.connectorStyle);
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
  const paddingReductionHint = computePaddingReductionHint(
    width,
    depth,
    gridUnitMm,
    xAxis,
    yAxis,
    pieceCount
  );

  const tiling: BaseplateTiling = {
    isSplit,
    pieces,
    margins: emitMargins(params, { colSizes, rowSizes, colOffsets, rowOffsets }),
    cols: colSizes.length,
    rows: rowSizes.length,
    totalWidthUnits: width,
    totalDepthUnits: depth,
    bedLoads,
    stackCount: 1,
    stackSeparatorThickness: 0,
    paddingReductionHint,
  };
  return params.outline !== undefined
    ? applyOutlineToTiling(tiling, params, printBedWidthMm, printBedDepthMm)
    : tiling;
}

/**
 * Shape a rectangular tiling with the plate outline (issue #2528):
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
 * `placementRotationDeg` is forced to 0: the preferIdenticalPieces 180° mesh
 * sharing pairs opposite corners of a SYMMETRIC tiling, which dropping and
 * reclassification break. Congruent pieces still dedupe via identical
 * fingerprints.
 *
 * Shaped plates carry zero padding (sanitized upstream), so windows are pure
 * grid extents and margins are always empty.
 */
function applyOutlineToTiling(
  tiling: BaseplateTiling,
  params: ResolvedBaseplateParams,
  printBedWidthMm: number,
  printBedDepthMm: number
): BaseplateTiling {
  const outline = params.outline as DrawerOutline;
  const u = params.gridUnitMm;

  const windowOf = (piece: BaseplatePiece): { x0: number; y0: number; x1: number; y1: number } => ({
    x0: piece.gridOffsetX * u,
    y0: piece.gridOffsetY * u,
    x1: (piece.gridOffsetX + piece.widthUnits) * u,
    y1: (piece.gridOffsetY + piece.depthUnits) * u,
  });

  const classByKey = new Map<string, RegionClass>();
  for (const piece of tiling.pieces) {
    const w = windowOf(piece);
    classByKey.set(`${piece.col},${piece.row}`, classifyRect(outline, w.x0, w.y0, w.x1, w.y1));
  }
  const classAt = (col: number, row: number): RegionClass =>
    classByKey.get(`${col},${row}`) ?? 'outside';

  // A seam keeps its connector only when the one-cell band on BOTH sides of
  // the entire shared span is fully inside the outline.
  const fullSeam = (piece: BaseplatePiece, side: 'left' | 'right' | 'front' | 'back'): boolean => {
    const w = windowOf(piece);
    if (side === 'left' || side === 'right') {
      const xB = side === 'left' ? w.x0 : w.x1;
      return (
        classifyRect(outline, xB - u, w.y0, xB, w.y1) === 'inside' &&
        classifyRect(outline, xB, w.y0, xB + u, w.y1) === 'inside'
      );
    }
    const yB = side === 'front' ? w.y0 : w.y1;
    return (
      classifyRect(outline, w.x0, yB - u, w.x1, yB) === 'inside' &&
      classifyRect(outline, w.x0, yB, w.x1, yB + u) === 'inside'
    );
  };

  const NEIGHBOR: Record<'left' | 'right' | 'front' | 'back', readonly [number, number]> = {
    left: [-1, 0],
    right: [1, 0],
    front: [0, -1],
    back: [0, 1],
  };

  const survivors: BaseplatePiece[] = [];
  for (const piece of tiling.pieces) {
    const cls = classAt(piece.col, piece.row);
    if (cls === 'outside') continue;

    const edges = { ...piece.edges };
    for (const side of ['left', 'right', 'front', 'back'] as const) {
      if (edges[side] !== 'join') continue;
      const [dc, dr] = NEIGHBOR[side];
      const neighborDropped = classAt(piece.col + dc, piece.row + dr) === 'outside';
      if (neighborDropped || !fullSeam(piece, side)) edges[side] = 'exterior';
    }

    const w = windowOf(piece);
    survivors.push({
      ...piece,
      edges,
      placementRotationDeg: 0,
      ...(cls === 'partial' ? { outlineWindowOriginMm: { x: w.x0, y: w.y0 } } : {}),
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
  // Partial pieces get the plate outline translated into their local frame;
  // the generator's 3D intersect performs the window clip (the piece slab IS
  // the window), so no 2D clipping is needed here. Fully-inside pieces carry
  // no outline and stay byte-identical to unshaped rectangles.
  const pieceOutline =
    parentParams.outline !== undefined && piece.outlineWindowOriginMm !== undefined
      ? translateOutline(
          parentParams.outline,
          -piece.outlineWindowOriginMm.x,
          -piece.outlineWindowOriginMm.y
        )
      : undefined;

  return {
    width: piece.widthUnits,
    depth: piece.depthUnits,
    gridUnitMm: parentParams.gridUnitMm,
    outline: pieceOutline,
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
    connectorNubs: parentParams.connectorNubs,
    // Dovetail key seams are symmetric, so connectorStyle is rotation-invariant —
    // copy it straight through (unlike padding/edges, which rotate with `rot`).
    connectorStyle: parentParams.connectorStyle,
    // The fit offset and nozzle both size the female groove clearance
    // (effectiveClearance), so they must reach every split piece — otherwise the
    // groove is cut at nominal regardless of the user's tolerance (issue #2554).
    // Per-side clearance is symmetric, so both are rotation-invariant.
    connectorFitOffset: parentParams.connectorFitOffset,
    nozzleSizeMm: parentParams.nozzleSizeMm,
    invertDovetails: parentParams.invertDovetails,
    preferIdenticalPieces: parentParams.preferIdenticalPieces,
    lightweight: parentParams.lightweight,
    solidFloor: parentParams.solidFloor,
    solidFloorThickness: parentParams.solidFloorThickness,
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
