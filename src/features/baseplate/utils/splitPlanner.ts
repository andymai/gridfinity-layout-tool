/**
 * Baseplate split planner — pure functions for computing how a large baseplate
 * should be tiled into printable pieces.
 *
 * The algorithm jointly optimizes both axes to minimize total piece count.
 * For each candidate (numCols × numRows) it verifies every piece fits the bed
 * with its edge-specific padding, then picks the tiling with fewest pieces.
 * Ties are broken by symmetry (prefer equal-sized pieces).
 *
 * Fractional half-unit edges are absorbed into the outermost piece when they
 * fit, otherwise become a separate piece.
 */

import type { BaseplateParams } from '@/shared/types/bin';
// The fit checker subtracts the tongue protrusion from the bed budget on male
// join edges — otherwise pieces that compute to exactly the bed width on paper
// exceed it as STLs (#1498).
import { TONGUE_PROTRUSION } from '@/shared/constants/connectors';
import type {
  BaseplatePiece,
  BaseplateTiling,
  PaddingReductionHint,
  PieceEdges,
} from '../types/tiling';

/** Threshold for detecting a fractional half-unit (avoids floating-point noise). */
const FRACTIONAL_THRESHOLD = 0.49;

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

  // For numChunks >= 2, distribute integer units as evenly as possible.
  const maxPerPos: number[] = Array.from({ length: numChunks }, (_, i) => {
    if (i === 0) return maxFirst;
    if (i === numChunks - 1) return maxLast;
    return maxMiddle;
  });

  // Total capacity check — bail early if the partition is impossible.
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

function chunkSizesFit(sizes: number[], gridUnitMm: number, axis: AxisConfig): boolean {
  const last = sizes.length - 1;
  for (let i = 0; i < sizes.length; i++) {
    const padStart = i === 0 ? axis.paddingStart : 0;
    const padEnd = i === last ? axis.paddingEnd : 0;
    // Join edges (interior sides) carry a male tongue's protrusion if the convention
    // assigns male to that side. Female sides cut into the slab and add nothing.
    const tongueStart = i === 0 ? 0 : axis.startMaleMm;
    const tongueEnd = i === last ? 0 : axis.endMaleMm;
    const sizeMm = sizes[i] * gridUnitMm + padStart + padEnd + tongueStart + tongueEnd;
    if (sizeMm > axis.bedMm + 0.001) return false;
  }
  return true;
}

/** Variance of an array — lower = more symmetric/equal. */
function symmetryScore(sizes: number[]): number {
  if (sizes.length <= 1) return 0;
  const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  return sizes.reduce((sum, s) => sum + (s - mean) ** 2, 0) / sizes.length;
}

interface TilingCandidate {
  colSizes: number[];
  rowSizes: number[];
  pieceCount: number;
  score: number;
}

/**
 * Find the optimal grid tiling: minimum pieces where every piece fits the bed.
 *
 * Searches over (numCols, numRows) pairs, partitioning each axis as evenly as
 * possible. Returns the best (colSizes, rowSizes) or a single-piece fallback.
 */
function findOptimalTiling(
  totalWidth: number,
  totalDepth: number,
  gridUnitMm: number,
  xAxis: AxisConfig,
  yAxis: AxisConfig
): { colSizes: number[]; rowSizes: number[] } {
  const maxCols = Math.ceil(totalWidth);
  const maxRows = Math.ceil(totalDepth);

  let best: TilingCandidate | null = null;

  for (let nc = 1; nc <= maxCols; nc++) {
    // Early exit: nc alone exceeds best piece count (nc * 1 > best).
    // Use > not >= so we still evaluate nc×1 candidates for symmetry tiebreaks.
    if (best && nc > best.pieceCount) break;

    const colSizes = partitionAxis(totalWidth, nc, gridUnitMm, xAxis);
    if (!colSizes) continue;

    for (let nr = 1; nr <= maxRows; nr++) {
      const pieceCount = nc * nr;
      if (best && pieceCount > best.pieceCount) break;

      const rowSizes = partitionAxis(totalDepth, nr, gridUnitMm, yAxis);
      if (!rowSizes) continue;

      if (allPiecesFit(colSizes, rowSizes, gridUnitMm, xAxis, yAxis)) {
        const score = symmetryScore(colSizes) + symmetryScore(rowSizes);
        if (
          !best ||
          pieceCount < best.pieceCount ||
          (pieceCount === best.pieceCount && score < best.score)
        ) {
          best = { colSizes, rowSizes, pieceCount, score };
        }
        break;
      }
    }
  }

  if (!best) return { colSizes: [totalWidth], rowSizes: [totalDepth] };
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

  // Pick best: most pieces saved, then smallest reduction
  candidates.sort((a, b) => b.piecesSaved - a.piecesSaved || a.reductionMm - b.reductionMm);
  return candidates[0];
}

/**
 * Compute the full 2D tiling for a baseplate.
 *
 * Takes the full generation params + print bed size and returns a tiling plan.
 * If the baseplate fits on a single bed, returns a single-piece tiling with
 * `isSplit: false`.
 */
export function computeBaseplateTiling(
  params: BaseplateParams,
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
    gridUnitMm,
    xAxis,
    fractionalEdgeX === 'start',
    palindromic
  );
  const rowSizes = reorderForDisplay(
    rawRowSizes,
    gridUnitMm,
    yAxis,
    fractionalEdgeY === 'start',
    palindromic
  );

  const isSplit = colSizes.length > 1 || rowSizes.length > 1;
  const colOffsets = cumulativeOffsets(colSizes);
  const rowOffsets = cumulativeOffsets(rowSizes);

  const lastCol = colSizes.length - 1;
  const lastRow = rowSizes.length - 1;

  const pieces: BaseplatePiece[] = [];

  for (let r = 0; r < rowSizes.length; r++) {
    for (let c = 0; c < colSizes.length; c++) {
      const isLeftEdge = c === 0;
      const isRightEdge = c === lastCol;
      const isFrontEdge = r === 0;
      const isBackEdge = r === lastRow;

      const actualEdges: PieceEdges = {
        left: isLeftEdge ? 'exterior' : 'join',
        right: isRightEdge ? 'exterior' : 'join',
        front: isFrontEdge ? 'exterior' : 'join',
        back: isBackEdge ? 'exterior' : 'join',
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
        paddingLeft: isLeftEdge ? paddingLeft : 0,
        paddingRight: isRightEdge ? paddingRight : 0,
        paddingFront: isFrontEdge ? paddingFront : 0,
        paddingBack: isBackEdge ? paddingBack : 0,
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

  return {
    isSplit,
    pieces,
    cols: colSizes.length,
    rows: rowSizes.length,
    totalWidthUnits: width,
    totalDepthUnits: depth,
    stackCount: 1,
    stackSeparatorThickness: 0,
    paddingReductionHint,
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
  parentParams: BaseplateParams
): BaseplateParams {
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
  return {
    width: piece.widthUnits,
    depth: piece.depthUnits,
    gridUnitMm: parentParams.gridUnitMm,
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
    // exterior padded edges get the gap-filling tiles.
    overTile: parentParams.overTile,
    connectorNubs: parentParams.connectorNubs,
    // Dovetail key seams are symmetric, so connectorStyle is rotation-invariant —
    // copy it straight through (unlike padding/edges, which rotate with `rot`).
    connectorStyle: parentParams.connectorStyle,
    invertDovetails: parentParams.invertDovetails,
    preferIdenticalPieces: parentParams.preferIdenticalPieces,
    lightweight: parentParams.lightweight,
    cornerRadius: parentParams.cornerRadius,
    cornerRadii: rot && pr ? { tl: pr.br, tr: pr.bl, bl: pr.tr, br: pr.tl } : pr,
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

/**
 * Reorder sizes for display: largest pieces at lowest indices (front/left),
 * while respecting edge constraints and fractional edge placement.
 *
 * When `fractionAtStart` is true and a fractional piece exists, it is pinned to
 * position 0 with the remaining pieces sorted descending.
 *
 * When `preferIdenticalPieces` is true, the integer-sized pieces are arranged
 * palindromically so opposite outer positions have identical sizes — this lets
 * A1 ≡ C2 and A2 ≡ C1 share a canonical fingerprint under 180° rotation.
 */
function reorderForDisplay(
  sizes: number[],
  gridUnitMm: number,
  axis: AxisConfig,
  fractionAtStart: boolean,
  preferIdenticalPieces: boolean
): number[] {
  if (sizes.length <= 1) return sizes;

  // Use the same per-position constraints as partitionAxis so dovetail tongues
  // are accounted for when reshuffling chunks across positions (#1498).
  const { maxFirst, maxLast, maxMiddle } = axisCapacity(gridUnitMm, axis);
  const fracIdx = sizes.findIndex(isFractional);

  // Pin fractional piece to position 0 (only if it fits there).
  if (fractionAtStart && fracIdx >= 0 && sizes[fracIdx] <= maxFirst) {
    const rest = sizes.filter((_, i) => i !== fracIdx);
    const inner = preferIdenticalPieces
      ? palindromizeWithEdges(rest, maxMiddle, maxLast, maxMiddle)
      : sortDescWithEdges(rest, maxMiddle, maxLast);
    return [sizes[fracIdx], ...inner];
  }

  // Pin fractional piece to last position (prevents middle placement).
  if (!fractionAtStart && fracIdx >= 0 && sizes[fracIdx] <= maxLast) {
    const rest = sizes.filter((_, i) => i !== fracIdx);
    const inner = preferIdenticalPieces
      ? palindromizeWithEdges(rest, maxFirst, maxMiddle, maxMiddle)
      : sortDescWithEdges(rest, maxFirst, maxMiddle);
    return [...inner, sizes[fracIdx]];
  }

  if (preferIdenticalPieces) {
    return palindromizeWithEdges(sizes, maxFirst, maxLast, maxMiddle);
  }

  return sortDescWithEdges(sizes, maxFirst, maxLast);
}

/**
 * Arrange sizes palindromically (sizes[i] = sizes[n-1-i] where possible) while
 * respecting edge constraints. Pairs equal values at outermost positions first,
 * then works inward.
 *
 * Returns sortDescWithEdges' result if no palindromic arrangement satisfies the
 * edge caps — the fitting checker would otherwise reject the tiling.
 */
function palindromizeWithEdges(
  sizes: readonly number[],
  maxFirst: number,
  maxLast: number,
  maxMiddle: number
): number[] {
  if (sizes.length <= 1) return [...sizes];

  const n = sizes.length;

  // Collect every value that can participate in a true palindromic pair (it
  // appears 2+ times in the multiset). What's left over after pairing — the
  // odd-count remainders — must occupy middle slots since no slot at the
  // outer edges can be the half of a matching pair. This finds palindromes
  // even when the unique value is the largest: [5, 4, 4] → pairs [(4,4)],
  // leftovers [5] → result [4, 5, 4].
  const freq = new Map<number, number>();
  for (const s of sizes) freq.set(s, (freq.get(s) ?? 0) + 1);
  const pairs: number[] = [];
  const leftovers: number[] = [];
  for (const [value, count] of freq) {
    for (let i = 0; i < Math.floor(count / 2); i++) pairs.push(value);
    if (count % 2 === 1) leftovers.push(value);
  }
  pairs.sort((a, b) => b - a); // largest pairs at outermost slots
  leftovers.sort((a, b) => b - a);

  const result = new Array<number>(n);
  let left = 0;
  let right = n - 1;
  for (const value of pairs) {
    if (left >= right) break;
    result[left++] = value;
    result[right--] = value;
  }
  for (const value of leftovers) {
    if (left > right) break;
    result[left++] = value;
  }

  // Fall back to the baseline sort if the palindromic layout would overrun a
  // first/last edge cap OR a middle cap (middle slots can have stricter caps
  // than edges when both join sides claim tongue protrusion — only matters
  // for non-standard small gridUnitMm where floor(bed/gu) > floor((bed-P)/gu)).
  const middleOverflow = (): boolean => {
    for (let i = 1; i < n - 1; i++) if (result[i] > maxMiddle) return true;
    return false;
  };
  if (result[0] > maxFirst || result[n - 1] > maxLast || middleOverflow()) {
    return sortDescWithEdges([...sizes], maxFirst, maxLast);
  }
  return result;
}

/**
 * Sort sizes descending while ensuring position 0 fits within paddingFirst
 * and the last position fits within paddingLast.
 *
 * Falls back to the original order if constraints cannot be satisfied.
 */
function sortDescWithEdges(sizes: number[], maxFirst: number, maxLast: number): number[] {
  const pool = [...sizes].sort((a, b) => b - a);

  const firstIdx = pool.findIndex((v) => v <= maxFirst);
  if (firstIdx < 0) return sizes;
  const first = pool.splice(firstIdx, 1)[0];

  if (pool.length === 0 || pool[pool.length - 1] <= maxLast) {
    return [first, ...pool];
  }

  const validLastIdx = pool.findIndex((v) => v <= maxLast);
  if (validLastIdx < 0) return sizes;
  const lastPiece = pool.splice(validLastIdx, 1)[0];
  return [first, ...pool, lastPiece];
}

function cumulativeOffsets(sizes: number[]): number[] {
  const offsets: number[] = [0];
  for (let i = 1; i < sizes.length; i++) {
    offsets.push(offsets[i - 1] + sizes[i - 1]);
  }
  return offsets;
}

function isFractional(value: number): boolean {
  return value - Math.floor(value) >= FRACTIONAL_THRESHOLD;
}
