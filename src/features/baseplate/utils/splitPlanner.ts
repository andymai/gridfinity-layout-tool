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
import { GRIDFINITY } from '@/shared/constants/bin';
import type { BaseplatePiece, BaseplateTiling, PieceEdges } from '../types/tiling';
import { estimateBedLoads } from './bedPacking';
import type { DrawerOutline } from '@/core/types';
import { rotateOutline180, translateOutline } from '@/shared/utils/drawerOutline';
import { classifyRect, type RegionClass } from '@/shared/utils/drawerOutlineGeometry';
import { isFractional, reorderForDisplay } from './splitReorder';
import {
  colToLetter,
  detachedSides,
  makeAxisConfig,
  axisCapacity,
  tilingBedLoads,
  findOptimalTiling,
  computePaddingReductionHint,
  computeBedOverages,
} from './splitTiling';
export { colToLetter } from './splitTiling';
import { emitMargins } from './splitMargins';

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
