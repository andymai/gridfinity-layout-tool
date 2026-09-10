/**
 * Discrete dovetail connectors at grid cell boundary intersections along
 * join edges.
 *
 * Each connector is a small trapezoidal prism — the classic dovetail fan
 * shape visible from the top: narrower at the wall (BASE_HALF), wider at the
 * protruding tip (TIP_HALF).
 *
 *   Top view (X-Y) of one connector on a left edge:
 *
 *     wall
 *      |  A ──── B         Y = bPos + BASE_HALF (wall) / + TIP_HALF (tip)
 *      |  |  dt  |
 *      |  D ──── C         Y = bPos - BASE_HALF (wall) / - TIP_HALF (tip)
 *      |  ← P →
 *
 * The dovetail taper is in the X-Y plane, so pieces drop in from above (Z)
 * without interference. Once seated, the wider tip prevents horizontal pull-out.
 *
 * Convention: left/front = tongue (male, fused), right/back = groove (female,
 * cut). Inverted by `invertDovetails`.
 *
 * Key style (`connectorStyle === 'dovetailKey'`): every join edge is female
 * (groove only, no tongue), and a separate `buildDovetailKey()` part is hammered
 * into the seam. Two opposing PUZZLE grooves across a seam form one dogbone
 * cavity — narrow at the seam, flaring to a rounded lobe inside each piece —
 * that the key locks into (the legacy trapezoid grooves' 0.3 mm/side undercut
 * printed away to nothing,; see {@link buildDovetailKey}). The groove uses
 * the tighter `DOVETAIL_KEY_CLEARANCE` for a press fit. `invertDovetails` and
 * `preferIdenticalPieces` are ignored in this mode (seams are symmetric).
 *
 * All profiles are drawn on the XY plane (normal=+Z) and extruded downward,
 * matching the pre-Z-shift coordinate system (slab top at Z=0, bottom at
 * Z=-totalHeight).
 */

import { translate, cutAll } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { isMarginSeamStyle, hasAllEdgeSlots, edgeCarriesSlot } from '@/shared/types/bin';
import { unwrap } from '@/core/result';
import {
  TONGUE_PROTRUSION,
  TONGUE_BASE_HALF,
  TONGUE_TIP_HALF,
  PUZZLE_HEAD_HALF,
  TONGUE_CLEARANCE,
  DOVETAIL_KEY_CLEARANCE,
  snapClipLevels,
  effectiveClearance,
  COPLANAR_MARGIN,
} from './generatorTypes';
import { computeCellBoundariesMm, computeCellCentersMm, decomposeCells } from './cellDecomposition';
import { getPocketTemplate } from './baseplatePockets';
import {
  makeTongue,
  makeGroove,
  makePuzzleTongue,
  makePuzzleGroove,
  makeSnapPocket,
} from './connectorShapes';
export {
  makeTongue,
  makeGroove,
  buildMarginSeamGroove,
  makePuzzleTongue,
  makePuzzleGroove,
  buildDovetailKey,
  makeSnapPocket,
  relieveClipForSockets,
  buildSnapClip,
  buildSnapClipForPrint,
} from './connectorShapes';

/**
 * Half the separation between the tongue and groove of a paired connector,
 * measured along the edge axis. Paired connectors sit at `bp ± PAIR_HALF_OFFSET`
 * around each cell boundary.
 *
 * Sized so the two feature footprints (tip half-width ≈ 1.45 mm including
 * clearance) plus a comfortable gap fit inside a single grid cell (42 mm).
 */
const PAIR_HALF_OFFSET = 4;

/** Origin-centred cell spans (centre + size mm) along one grid axis. */
interface CellSpan {
  readonly center: number;
  readonly size: number;
}

/**
 * Cell centres + sizes along an axis, origin-centred to match the slab pockets
 * (which are placed at {@link forEachCell} positions). Honours `fractionalEdge`
 * so a half-cell at the start shifts the full cells like the pockets do.
 */
function cellSpansMm(
  axisUnits: number,
  gridUnitMm: number,
  fractionalEdge: 'start' | 'end' = 'end'
): CellSpan[] {
  const cells = decomposeCells(axisUnits);
  if (fractionalEdge === 'start') cells.reverse();
  const totalMm = axisUnits * gridUnitMm;
  const spans: CellSpan[] = [];
  let pos = 0;
  for (const u of cells) {
    const size = u * gridUnitMm;
    spans.push({ center: pos + size / 2 - totalMm / 2, size });
    pos += size;
  }
  return spans;
}

/**
 * Subtract the neighbouring piece's bin sockets from a fused dovetail tongue.
 *
 * The gridfinity socket mouth opens to the full cell at the slab top
 * (`INSET_TOP = 0`), so a flat-topped tongue protruding across the seam pokes
 * into the open socket where the neighbour's bin foot seats — worst in paired
 * (`preferIdenticalPieces`) mode, where the tongue is offset `PAIR_HALF_OFFSET`
 * (= the socket corner radius) onto the fully-open straight edge of the mouth.
 *
 * Cutting the actual socket pocket(s) back out of the tongue trims it to the
 * grid's wall region, so the assembled plate's top matches an un-split plate and
 * bins seat flush. The tongue keeps its sub-funnel material (the socket recedes
 * with depth), so the dovetail still locks. Mirrors {@link relieveClipForSockets}.
 *
 * The neighbour column lies one full grid unit beyond the seam (`neighborProtrude`);
 * only sockets the tongue actually reaches (within `reach` of its boundary
 * position) are subtracted.
 */
function relieveTongueForSockets(
  tongue: Shape3D,
  bpTongue: number,
  neighborProtrude: number,
  protrudeAxis: 'x' | 'y',
  boundaryCells: readonly CellSpan[],
  gridUnitMm: number,
  magnetHoles: boolean,
  forExport: boolean
): Shape3D {
  // Widest tongue half-width (the puzzle head ≥ the legacy tip) plus groove
  // clearance and a small margin — the boundary-axis reach over which a neighbour
  // socket can touch the tongue. Over-reaching for the narrower legacy dovetail is
  // harmless (only overlapping sockets are actually subtracted).
  const reach = PUZZLE_HEAD_HALF + TONGUE_CLEARANCE + 0.5;
  // Match the slab's pocket depth: through-cut without magnets, blind (socket
  // region only) with magnets so the tongue keeps its floor/joint material.
  const throughCut = !magnetHoles;
  const cutters: ValidSolid[] = [];
  for (const cell of boundaryCells) {
    if (cell.center - cell.size / 2 >= bpTongue + reach) continue;
    if (cell.center + cell.size / 2 <= bpTongue - reach) continue;
    // Neighbour cell: full grid unit along the protrude axis, this cell's size
    // along the boundary axis (the grid is continuous across the seam).
    const pocket =
      protrudeAxis === 'x'
        ? getPocketTemplate(gridUnitMm, cell.size, forExport, throughCut)
        : getPocketTemplate(cell.size, gridUnitMm, forExport, throughCut);
    const pos: [number, number, number] =
      protrudeAxis === 'x'
        ? [neighborProtrude, cell.center, 0]
        : [cell.center, neighborProtrude, 0];
    const positioned = translate(pocket, pos);
    pocket.delete();
    cutters.push(positioned as ValidSolid);
  }
  if (cutters.length === 0) return tongue;
  const relieved = unwrap(cutAll(tongue as ValidSolid, cutters));
  for (const c of cutters) c.delete();
  if (relieved !== tongue) tongue.delete();
  return relieved;
}

export function buildConnectors(
  params: ResolvedBaseplateParams,
  totalHeight: number,
  totalW: number,
  totalD: number,
  slabOffsetX: number,
  slabOffsetY: number,
  forExport: boolean = true
): { nubs: Shape3D[]; holes: Shape3D[] } {
  const { edges, connectorNubs, invertDovetails, preferIdenticalPieces } = params;
  const tongues: Shape3D[] = [];
  const grooves: Shape3D[] = [];

  if (!edges) return { nubs: tongues, holes: grooves };
  // The opt-in margin-seam connector is gated independently of
  // `connectorNubs` (split-piece connectors) — a user can want a rail connector
  // without split-piece dovetails. The integral styles put a tongue on the seam;
  // `dovetailKey` puts a groove there and lets the seated key span it.
  // snapClip stays friction-fit (splitPlanner enforces this, and this guard keeps
  // the function self-consistent if called directly).
  const hasMarginSeam =
    isMarginSeamStyle(params.connectorStyle) &&
    (edges.left === 'marginSeam' ||
      edges.right === 'marginSeam' ||
      edges.front === 'marginSeam' ||
      edges.back === 'marginSeam');
  if (!connectorNubs && !hasMarginSeam) return { nubs: tongues, holes: grooves };

  // Dovetail key & snap clip modes: every join edge is female (a groove / a
  // blind ledged pocket, no tongues), and a separate part spans the seam.
  // Handedness toggles (invert / paired) are meaningless when both sides are
  // female, so they're bypassed for both.
  const isDovetailKey = params.connectorStyle === 'dovetailKey';
  const isSnapClip = params.connectorStyle === 'snapClip';
  const bothFemale = isDovetailKey || isSnapClip;
  // Puzzle: an integral jigsaw-tab tongue/groove (stronger than the legacy
  // slip-fit `dovetail`,). Integral, so invert/paired apply normally.
  const isPuzzle = params.connectorStyle === 'puzzle';

  // Snap-clip blind pockets need a minimum leg-flex depth; on a slab too thin
  // to flex, skip them (the part would snap off rather than click). The UI
  // still offers the style; the geometry simply degrades to no connectors.
  const snapLevels = isSnapClip
    ? snapClipLevels(totalHeight, params.connectorFitOffset ?? 0, params.nozzleSizeMm)
    : null;
  if (isSnapClip && (!snapLevels || !snapLevels.viable)) return { nubs: tongues, holes: grooves };

  const invert = !!invertDovetails && !bothFemale;
  // In paired mode invertDovetails is intentionally ignored — the layout is
  // 180°-rotationally symmetric by construction, so an "invert" toggle would
  // produce the same physical connector orientation on both sides.
  const paired = !!preferIdenticalPieces && !bothFemale;

  const halfW = totalW / 2;
  const halfD = totalD / 2;
  const gridUnit = params.gridUnitMm;
  // Depth-axis pitch for a non-square grid; equals gridUnit for square.
  const gridUnitY = params.gridUnitMmY ?? gridUnit;
  const P = TONGUE_PROTRUSION;
  const bW = TONGUE_BASE_HALF; // half-width at wall (narrow)
  const tW = TONGUE_TIP_HALF; // half-width at tip (wide)
  // Per-side groove clearance, shifted by the user's fit offset
  // and clamped so it can never go negative. The tongue/key stay at nominal
  // size — only the groove the user prints around them grows or shrinks.
  const baseClearance = isDovetailKey ? DOVETAIL_KEY_CLEARANCE : TONGUE_CLEARANCE;
  const cl = effectiveClearance(baseClearance, params.connectorFitOffset ?? 0, params.nozzleSizeMm);
  const ext = COPLANAR_MARGIN;

  // Honors fractionalEdgeX/Y so dovetails land on cell boundaries even when
  // the half-cell is at the start (rotated piece under preferIdenticalPieces).
  const yBoundaries = computeCellBoundariesMm(params.depth, gridUnitY, params.fractionalEdgeY);
  const xBoundaries = computeCellBoundariesMm(params.width, gridUnit, params.fractionalEdgeX);

  // Cell centers along each axis — where the margin-seam connector places one
  // tongue per cell (unlike the split-piece dovetails, which sit on boundaries).
  const yCenters = computeCellCentersMm(params.depth, gridUnitY, params.fractionalEdgeY);
  const xCenters = computeCellCentersMm(params.width, gridUnit, params.fractionalEdgeX);

  // Cell layout along each edge's boundary axis — used to subtract the
  // neighbouring piece's sockets from each tongue (the grid is continuous across
  // the seam, so the neighbour column shares this piece's boundary-axis cells).
  const yCellSpans = cellSpansMm(params.depth, gridUnitY, params.fractionalEdgeY);
  const xCellSpans = cellSpansMm(params.width, gridUnit, params.fractionalEdgeX);

  type Side = 'left' | 'right' | 'front' | 'back';

  /**
   * `maleOffsetSign` (paired mode only): the clockwise-around-the-part-earlier
   * side of each boundary point gets the tongue, the clockwise-later side gets
   * the groove. With this convention the dovetail layout is 180°-rotationally
   * invariant — rotating the canonical mesh 180° produces an identical mesh,
   * which lets two pieces that are 180° rotations of each other share a
   * fingerprint and a generated STL.
   *
   * Clockwise traversal around the part (viewed from +Z):
   *   - front edge: FL → FR (+x), so clockwise-earlier on F = smaller x → sign -1
   *   - right edge: FR → BR (+y), so clockwise-earlier on R = smaller y → sign -1
   *   - back edge:  BR → BL (-x), so clockwise-earlier on B = larger  x → sign +1
   *   - left edge:  BL → FL (-y), so clockwise-earlier on L = larger  y → sign +1
   */
  const edgeDefs: ReadonlyArray<{
    side: Side;
    isMale: boolean;
    maleOffsetSign: -1 | 1;
    wallPos: number;
    /** Drawer-fit padding on this side (mm) — an all-edge slot needs 0 here. */
    paddingMm: number;
    boundaries: readonly number[];
    centers: readonly number[];
    boundaryCells: readonly CellSpan[];
    protrudeAxis: 'x' | 'y';
    protrudeDir: -1 | 1;
  }> = [
    {
      side: 'left',
      isMale: !invert,
      maleOffsetSign: 1,
      wallPos: -halfW + slabOffsetX,
      paddingMm: params.paddingLeft,
      boundaries: yBoundaries,
      centers: yCenters,
      boundaryCells: yCellSpans,
      protrudeAxis: 'x',
      protrudeDir: -1,
    },
    {
      side: 'right',
      isMale: invert,
      maleOffsetSign: -1,
      wallPos: halfW + slabOffsetX,
      paddingMm: params.paddingRight,
      boundaries: yBoundaries,
      centers: yCenters,
      boundaryCells: yCellSpans,
      protrudeAxis: 'x',
      protrudeDir: 1,
    },
    {
      side: 'front',
      isMale: !invert,
      maleOffsetSign: -1,
      wallPos: -halfD + slabOffsetY,
      paddingMm: params.paddingFront,
      boundaries: xBoundaries,
      centers: xCenters,
      boundaryCells: xCellSpans,
      protrudeAxis: 'y',
      protrudeDir: -1,
    },
    {
      side: 'back',
      isMale: invert,
      maleOffsetSign: 1,
      wallPos: halfD + slabOffsetY,
      paddingMm: params.paddingBack,
      boundaries: xBoundaries,
      centers: xCenters,
      boundaryCells: xCellSpans,
      protrudeAxis: 'y',
      protrudeDir: 1,
    },
  ];

  // Build a tongue/groove with the right profile for the style: the legacy
  // trapezoid for `dovetail`/`dovetailKey`, or the rounded jigsaw lobe for
  // `puzzle`. Both are full-height (printable, no overhang, stack-safe).
  const mkTongue = (
    pt: (wall: number, bp: number) => [number, number],
    w: number,
    bp: number,
    d: -1 | 1
  ): Shape3D =>
    isPuzzle
      ? makePuzzleTongue(pt, w, bp, d, totalHeight)
      : makeTongue(pt, w, bp, d, P, bW, tW, totalHeight);
  const mkGroove = (
    pt: (wall: number, bp: number) => [number, number],
    w: number,
    bp: number,
    d: -1 | 1
  ): Shape3D =>
    isPuzzle
      ? makePuzzleGroove(pt, w, bp, d, cl, ext, totalHeight)
      : makeGroove(pt, w, bp, d, P, bW, tW, cl, ext, totalHeight);

  // Trim a freshly-built tongue back to the wall region so it can't poke into
  // the neighbouring piece's open sockets across the seam (`bpTongue` is the
  // tongue's centre along the edge's boundary axis).
  const relieveTongue = (
    tongue: Shape3D,
    bpTongue: number,
    def: (typeof edgeDefs)[number]
  ): Shape3D => {
    // The neighbour cell across the seam is a full grid unit along the protrude
    // axis — X for left/right edges, Y (non-square pitch) for front/back.
    const protrudePitch = def.protrudeAxis === 'x' ? gridUnit : gridUnitY;
    return relieveTongueForSockets(
      tongue,
      bpTongue,
      def.wallPos + def.protrudeDir * (protrudePitch / 2),
      def.protrudeAxis,
      def.boundaryCells,
      protrudePitch,
      params.magnetHoles,
      forExport
    );
  };

  // Build an XY point with wall/boundary coords assigned to the correct axis.
  // When protruding along X, wall is on X and boundary is on Y; vice versa for Y.
  const ptFor = (def: (typeof edgeDefs)[number]) =>
    def.protrudeAxis === 'x'
      ? (wallCoord: number, bpCoord: number): [number, number] => [wallCoord, bpCoord]
      : (wallCoord: number, bpCoord: number): [number, number] => [bpCoord, wallCoord];

  // All-edge slots: the exterior edges of a padding-free piece get the
  // same female slot the join seams do, so every piece is a standard 42mm tile
  // that keys into any plate printed later. Restricted to the both-female styles
  // (`hasAllEdgeSlots`), so the male branches below are unreachable for an
  // exterior edge — a tongue there would protrude past the drawer-facing wall.
  const allEdgeSlots = hasAllEdgeSlots(params);

  // Split-piece connectors only when the user enabled them.
  if (connectorNubs) {
    for (const def of edgeDefs) {
      if (!edgeCarriesSlot(edges[def.side], allEdgeSlots, def.paddingMm)) continue;
      if (def.boundaries.length === 0) continue;
      const pt = ptFor(def);
      // A shaped plate can gate this seam's connectors to the sub-span whose
      // bands sit inside the perimeter — positions come from the
      // planner in the same piece-centered mm as `def.boundaries`.
      const allowed = params.connectorFilter?.[def.side];

      for (const bp of def.boundaries) {
        if (allowed !== undefined && !allowed.some((a) => Math.abs(a - bp) < 0.05)) continue;
        const w = def.wallPos;
        const d = def.protrudeDir;

        if (isSnapClip && snapLevels) {
          // Both sides of every seam are blind ledged pockets; the snap clip
          // supplies the male half. Throat + chamber cut as two stacked cutters.
          grooves.push(...makeSnapPocket(pt, w, bp, d, snapLevels));
        } else if (isDovetailKey) {
          // Both sides of every seam are female; the key supplies the male half.
          // Puzzle-lobe grooves: the dogbone key's 1.0 mm/side undercut survives
          // FDM where the legacy trapezoid's 0.3 mm/side did not.
          grooves.push(makePuzzleGroove(pt, w, bp, d, cl, ext, totalHeight));
        } else if (paired) {
          const mBp = bp + def.maleOffsetSign * PAIR_HALF_OFFSET;
          const fBp = bp - def.maleOffsetSign * PAIR_HALF_OFFSET;
          tongues.push(relieveTongue(mkTongue(pt, w, mBp, d), mBp, def));
          grooves.push(mkGroove(pt, w, fBp, d));
        } else if (def.isMale) {
          tongues.push(relieveTongue(mkTongue(pt, w, bp, d), bp, def));
        } else {
          grooves.push(mkGroove(pt, w, bp, d));
        }
      }
    }
  }

  // Opt-in body↔long-rail connector, in one of two forms:
  //   - integral (dovetail/puzzle): one male tongue per mating grid cell along the
  //     detached exterior wall, protruding into the rail, so a long rail is
  //     anchored evenly along its length rather than at a single point;
  // - keyed (dovetailKey,): a female groove per interior cell BOUNDARY,
  //     with the seated key spanning into the rail's matching groove.
  // Either way the rail carries the mating half at the same anchors
  // (`buildMarginSeamGroove`). Rails are solid (no sockets), so no tongue relief
  // is needed. `hasMarginSeam` requires a style that supports a seam at all, so a
  // stray snapClip edge emits nothing.
  if (hasMarginSeam) {
    for (const def of edgeDefs) {
      if (edges[def.side] !== 'marginSeam') continue;
      const pt = ptFor(def);
      if (isDovetailKey) {
        // Keyed seam: female on the body too, with the rail carrying the
        // matching groove. Placed on cell BOUNDARIES rather than the tongue's cell
        // centers — a boundary puts the key at a junction of two body cells, which
        // is the four-foot layout `buildDovetailKey`'s socket relief is cut for. A
        // 1-cell-wide piece therefore has no boundary and stays friction-fit,
        // matching how a 1-cell split seam behaves.
        for (const bp of def.boundaries) {
          grooves.push(
            makePuzzleGroove(pt, def.wallPos, bp, def.protrudeDir, cl, ext, totalHeight)
          );
        }
        continue;
      }
      const positions = def.centers.length > 0 ? def.centers : [0];
      for (const bp of positions) tongues.push(mkTongue(pt, def.wallPos, bp, def.protrudeDir));
    }
  }

  return { nubs: tongues, holes: grooves };
}
