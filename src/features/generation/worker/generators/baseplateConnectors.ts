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
 * printed away to nothing, #2637; see {@link buildDovetailKey}). The groove uses
 * the tighter `DOVETAIL_KEY_CLEARANCE` for a press fit. `invertDovetails` and
 * `preferIdenticalPieces` are ignored in this mode (seams are symmetric).
 *
 * All profiles are drawn on the XY plane (normal=+Z) and extruded downward,
 * matching the pre-Z-shift coordinate system (slab top at Z=0, bottom at
 * Z=-totalHeight).
 */

import { draw, rotate, translate, intersect, cutAll, clone } from 'brepjs';
import type { Shape3D, ValidSolid, Drawing } from 'brepjs';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { isSeamConnectorStyle } from '@/shared/types/bin';
import { isOk, unwrap } from '@/core/result';
import {
  TONGUE_PROTRUSION,
  TONGUE_BASE_HALF,
  TONGUE_TIP_HALF,
  PUZZLE_NECK_HALF,
  PUZZLE_NECK_PROTRUSION,
  PUZZLE_HEAD_HALF,
  PUZZLE_PROTRUSION,
  PUZZLE_ARMPIT_FILLET,
  PUZZLE_HEAD_FILLET,
  TONGUE_CLEARANCE,
  DOVETAIL_KEY_CLEARANCE,
  CLEARANCE,
  SNAP_CLIP,
  snapClipLevels,
  effectiveClearance,
  COPLANAR_MARGIN,
  COPLANAR_OVERLAP,
  sketch,
} from './generatorTypes';
import type { SnapClipLevels } from '@/shared/constants/connectors';
import { computeCellBoundariesMm, computeCellCentersMm, decomposeCells } from './cellDecomposition';
import { buildSingleCellSocket } from './socketBuilder';
import { getPocketTemplate } from './baseplatePockets';

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
  // The opt-in margin-seam connector (#2414) is gated independently of
  // `connectorNubs` (split-piece connectors) — a user can want a rail connector
  // without split-piece dovetails. Only the integral tongue/groove styles carry
  // a seam; snapClip/dovetailKey stay friction-fit (splitPlanner enforces this,
  // and this guard keeps the function self-consistent if called directly).
  const hasMarginSeam =
    isSeamConnectorStyle(params.connectorStyle) &&
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
  // slip-fit `dovetail`, issue #2241). Integral, so invert/paired apply normally.
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
  const P = TONGUE_PROTRUSION;
  const bW = TONGUE_BASE_HALF; // half-width at wall (narrow)
  const tW = TONGUE_TIP_HALF; // half-width at tip (wide)
  // Per-side groove clearance, shifted by the user's fit offset (issue #2024)
  // and clamped so it can never go negative. The tongue/key stay at nominal
  // size — only the groove the user prints around them grows or shrinks.
  const baseClearance = isDovetailKey ? DOVETAIL_KEY_CLEARANCE : TONGUE_CLEARANCE;
  const cl = effectiveClearance(baseClearance, params.connectorFitOffset ?? 0, params.nozzleSizeMm);
  const ext = COPLANAR_MARGIN;

  // Honors fractionalEdgeX/Y so dovetails land on cell boundaries even when
  // the half-cell is at the start (rotated piece under preferIdenticalPieces).
  const yBoundaries = computeCellBoundariesMm(params.depth, gridUnit, params.fractionalEdgeY);
  const xBoundaries = computeCellBoundariesMm(params.width, gridUnit, params.fractionalEdgeX);

  // Cell centers along each axis — where the margin-seam connector places one
  // tongue per cell (unlike the split-piece dovetails, which sit on boundaries).
  const yCenters = computeCellCentersMm(params.depth, gridUnit, params.fractionalEdgeY);
  const xCenters = computeCellCentersMm(params.width, gridUnit, params.fractionalEdgeX);

  // Cell layout along each edge's boundary axis — used to subtract the
  // neighbouring piece's sockets from each tongue (the grid is continuous across
  // the seam, so the neighbour column shares this piece's boundary-axis cells).
  const yCellSpans = cellSpansMm(params.depth, gridUnit, params.fractionalEdgeY);
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
  ): Shape3D =>
    relieveTongueForSockets(
      tongue,
      bpTongue,
      def.wallPos + def.protrudeDir * (gridUnit / 2),
      def.protrudeAxis,
      def.boundaryCells,
      gridUnit,
      params.magnetHoles,
      forExport
    );

  // Build an XY point with wall/boundary coords assigned to the correct axis.
  // When protruding along X, wall is on X and boundary is on Y; vice versa for Y.
  const ptFor = (def: (typeof edgeDefs)[number]) =>
    def.protrudeAxis === 'x'
      ? (wallCoord: number, bpCoord: number): [number, number] => [wallCoord, bpCoord]
      : (wallCoord: number, bpCoord: number): [number, number] => [bpCoord, wallCoord];

  // Split-piece connectors only when the user enabled them.
  if (connectorNubs) {
    for (const def of edgeDefs) {
      if (edges[def.side] !== 'join' || def.boundaries.length === 0) continue;
      const pt = ptFor(def);

      for (const bp of def.boundaries) {
        const w = def.wallPos;
        const d = def.protrudeDir;

        if (isSnapClip && snapLevels) {
          // Both sides of every seam are blind ledged pockets; the snap clip
          // supplies the male half. Throat + chamber cut as two stacked cutters.
          grooves.push(...makeSnapPocket(pt, w, bp, d, snapLevels));
        } else if (isDovetailKey) {
          // Both sides of every seam are female; the key supplies the male half.
          // Puzzle-lobe grooves: the dogbone key's 1.0 mm/side undercut survives
          // FDM where the legacy trapezoid's 0.3 mm/side did not (#2637).
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

  // Opt-in body↔long-rail connector (#2414): one male tongue per mating grid
  // cell along the detached exterior wall, protruding into the rail — so a long
  // rail is anchored evenly along its length rather than at a single point
  // (#2428). The rail carries the matching grooves
  // (`buildMarginSeamGroove` at the same cell centers). Rails are solid (no
  // sockets), so no relief is needed. `hasMarginSeam` already requires a
  // dovetail/puzzle style, so a stray snapClip/dovetailKey edge emits no tongue.
  if (hasMarginSeam) {
    for (const def of edgeDefs) {
      if (edges[def.side] !== 'marginSeam') continue;
      const pt = ptFor(def);
      const positions = def.centers.length > 0 ? def.centers : [0];
      for (const bp of positions) tongues.push(mkTongue(pt, def.wallPos, bp, def.protrudeDir));
    }
  }

  return { nubs: tongues, holes: grooves };
}

/**
 * Dovetail tongue: trapezoidal plan view, wider at tip. The base edge is
 * extended COPLANAR_OVERLAP into the slab so the fuse has shared volume rather
 * than a degenerate coplanar interface at the wall face (issue #1407).
 */
export function makeTongue(
  pt: (wall: number, bp: number) => [number, number],
  w: number,
  bp: number,
  d: -1 | 1,
  P: number,
  bW: number,
  tW: number,
  totalHeight: number
): Shape3D {
  const profile = draw(pt(w - d * COPLANAR_OVERLAP, bp + bW))
    .lineTo(pt(w + d * P, bp + tW))
    .lineTo(pt(w + d * P, bp - tW))
    .lineTo(pt(w - d * COPLANAR_OVERLAP, bp - bW))
    .close();
  return sketch(profile, 'XY', 0).extrude(-totalHeight);
}

/** Dovetail groove: matching shape + clearance, extended beyond wall and in Z. */
export function makeGroove(
  pt: (wall: number, bp: number) => [number, number],
  w: number,
  bp: number,
  d: -1 | 1,
  P: number,
  bW: number,
  tW: number,
  cl: number,
  ext: number,
  totalHeight: number
): Shape3D {
  const gB = bW + cl;
  const gT = tW + cl;
  const gP = P + cl;
  const profile = draw(pt(w + d * ext, bp + gB))
    .lineTo(pt(w - d * gP, bp + gT))
    .lineTo(pt(w - d * gP, bp - gT))
    .lineTo(pt(w + d * ext, bp - gB))
    .close();
  return sketch(profile, 'XY', COPLANAR_MARGIN).extrude(-(totalHeight + 2 * COPLANAR_MARGIN));
}

/**
 * Groove carved into a detached long rail's seam face to receive one of the
 * body's margin-seam tongues (#2414). Uses the same profile/clearance the tongue
 * does so they mate, positioned along the seam by `tongueOffsetMm` (the caller
 * cuts one per cell). Built in the rail's own origin-centered frame (see
 * `baseplateMargin.buildMarginSolid`): the seam face is the rail's inner long
 * edge (+railD/2 front, −railD/2 back, +railW/2 left, −railW/2 right), and the
 * groove cuts inward from it — `d` equals that face's sign. Only `dovetail`/
 * `puzzle` styles reach here.
 */
export function buildMarginSeamGroove(
  side: 'left' | 'right' | 'front' | 'back',
  railW: number,
  railD: number,
  totalHeight: number,
  connectorStyle: ResolvedBaseplateParams['connectorStyle'],
  fitOffset: number,
  nozzleSizeMm?: number,
  tongueOffsetMm: number = 0
): Shape3D {
  const horizontal = side === 'front' || side === 'back';
  const seamSign: -1 | 1 = side === 'front' || side === 'left' ? 1 : -1;
  const seamPos = seamSign * (horizontal ? railD / 2 : railW / 2);
  // Rail seam runs along X for front/back rails (wall coord on Y) and along Y
  // for left/right rails (wall coord on X). `tongueOffsetMm` slides the groove
  // along that axis onto the mating body tongue — nonzero on a corner-owning end
  // segment whose rail center no longer sits on the body wall it joins (#2427).
  const pt: (wall: number, bp: number) => [number, number] = horizontal
    ? (wall, bp) => [bp, wall]
    : (wall, bp) => [wall, bp];
  const cl = effectiveClearance(TONGUE_CLEARANCE, fitOffset, nozzleSizeMm);
  return connectorStyle === 'puzzle'
    ? makePuzzleGroove(pt, seamPos, tongueOffsetMm, seamSign, cl, COPLANAR_MARGIN, totalHeight)
    : makeGroove(
        pt,
        seamPos,
        tongueOffsetMm,
        seamSign,
        TONGUE_PROTRUSION,
        TONGUE_BASE_HALF,
        TONGUE_TIP_HALF,
        cl,
        COPLANAR_MARGIN,
        totalHeight
      );
}

/**
 * One half of a puzzle (jigsaw-tab) plan-view outline (`connectorStyle: 'puzzle'`),
 * drawn from the wall outward in the `pd` protrusion direction: a narrow neck
 * (half-width `PUZZLE_NECK_HALF`) flaring to a wider, rounded HEAD lobe
 * (`PUZZLE_HEAD_HALF`). The re-entrant neck→head armpits ({@link PUZZLE_ARMPIT_FILLET})
 * and the head's shoulder + tip corners ({@link PUZZLE_HEAD_FILLET}) are rounded so
 * the tab reads as a clean designed lobe and the neck loses its stress riser.
 *
 * `clear` grows every face away from the solid (0 for the tongue, the groove
 * clearance for the groove); `wallBack` is how far the wall end runs back AGAINST
 * the protrusion (COPLANAR_OVERLAP into the slab for the tongue's fuse; the cut's
 * overhang past the wall for the groove). Total reach is `PUZZLE_PROTRUSION`
 * (= TONGUE_PROTRUSION) so bed-budget/bbox math matches the legacy dovetail.
 */
function puzzleOutline(
  pt: (wall: number, bp: number) => [number, number],
  w: number,
  bp: number,
  pd: -1 | 1,
  clear: number,
  wallBack: number
): Drawing {
  const nH = PUZZLE_NECK_HALF + clear;
  const hH = PUZZLE_HEAD_HALF + clear;
  // Shoulder moves wall-ward by the clearance so the seated head's underside keeps
  // a per-side gap to the groove ledge it locks against. Clamp at 0: a wide nozzle
  // plus a max positive fit offset can grow `clear` past PUZZLE_NECK_PROTRUSION,
  // which would drive the neck→head transition behind the wall plane and invert the
  // outline — the neck constriction (the lock) collapses, but the geometry stays valid.
  const nP = Math.max(0, PUZZLE_NECK_PROTRUSION - clear);
  const reach = PUZZLE_PROTRUSION + clear;
  const fA = PUZZLE_ARMPIT_FILLET;
  const fH = PUZZLE_HEAD_FILLET;
  return draw(pt(w - pd * wallBack, bp + nH))
    .lineTo(pt(w + pd * nP, bp + nH))
    .customCorner(fA) // +side armpit (re-entrant neck→head notch)
    .lineTo(pt(w + pd * nP, bp + hH))
    .customCorner(fH) // +side shoulder (rounds the lobe)
    .lineTo(pt(w + pd * reach, bp + hH))
    .customCorner(fH) // +side tip
    .lineTo(pt(w + pd * reach, bp - hH))
    .customCorner(fH) // −side tip
    .lineTo(pt(w + pd * nP, bp - hH))
    .customCorner(fH) // −side shoulder
    .lineTo(pt(w + pd * nP, bp - nH))
    .customCorner(fA) // −side armpit
    .lineTo(pt(w - pd * wallBack, bp - nH))
    .close();
}

/**
 * Puzzle tongue (male). Protrudes in `+d`; its head, wider than the neck, is
 * trapped against horizontal pull-out by the neck constriction in the mating
 * groove once the pieces drop together vertically. Full-height and a constant Z
 * cross-section, so the protrusion prints as a self-supported prism with no
 * overhang — in either orientation, so it stack-prints cleanly too.
 */
export function makePuzzleTongue(
  pt: (wall: number, bp: number) => [number, number],
  w: number,
  bp: number,
  d: -1 | 1,
  totalHeight: number
): Shape3D {
  const profile = puzzleOutline(pt, w, bp, d, 0, COPLANAR_OVERLAP);
  return sketch(profile, 'XY', 0).extrude(-totalHeight);
}

/** Puzzle groove (female): the tongue outline grown by `cl` on every face, carved
 *  in `−d` (into the piece) and extended beyond the wall and in Z. */
export function makePuzzleGroove(
  pt: (wall: number, bp: number) => [number, number],
  w: number,
  bp: number,
  d: -1 | 1,
  cl: number,
  ext: number,
  totalHeight: number
): Shape3D {
  const profile = puzzleOutline(pt, w, bp, -d as -1 | 1, cl, ext);
  return sketch(profile, 'XY', COPLANAR_MARGIN).extrude(-(totalHeight + 2 * COPLANAR_MARGIN));
}

/**
 * Free-standing seam key for `connectorStyle === 'dovetailKey'`: two puzzle
 * lobes mirrored across the waist into one dogbone prism, centered on the
 * origin with its long axis along X. Narrow at the waist (`PUZZLE_NECK_HALF`,
 * sits across the seam), flaring to a rounded head inside each piece
 * (`PUZZLE_HEAD_HALF`), mating the puzzle grooves the key mode cuts.
 *
 * This replaced the original double-dovetail bowtie: its 0.3 mm/side undercut
 * was swallowed whole by FDM corner rounding + first-layer squish, so printed
 * keys came out near-rectangular and wouldn't hold (#2637). The puzzle lobe's
 * 1.0 mm/side undercut (`PUZZLE_HEAD_HALF − PUZZLE_NECK_HALF`) is the profile
 * the integral 'puzzle' style already prints reliably. The style id stays
 * `dovetailKey` so saved designs keep working; plates printed with the old
 * trapezoid grooves need a reprint to accept the new key — those keys never
 * held, so there is no working fit to preserve.
 *
 * Built at nominal dimensions — the seam grooves carry
 * `DOVETAIL_KEY_CLEARANCE`, so the per-face gap to the cavity comes from there.
 * The head corners are then relieved against the four bin feet flanking the
 * junction ({@link relieveForNeighborSockets}): the socket mouth opens to the
 * full cell at the slab top, and the wider head (vs the old 1.3 mm half-width
 * tips) reaches into it near the top. Extruded downward for the relief (seated
 * frame, feet carve from the top), then lifted so the bottom sits at Z=0
 * (bed-ready, relief scallops up); full height matches the plate's
 * `totalHeight` so the seated key is flush with the plate top.
 */
export function buildDovetailKey(totalHeight: number, gridUnitMm: number): Shape3D {
  const nH = PUZZLE_NECK_HALF;
  const hH = PUZZLE_HEAD_HALF;
  const nP = PUZZLE_NECK_PROTRUSION;
  const reach = PUZZLE_PROTRUSION;
  const fA = PUZZLE_ARMPIT_FILLET;
  const fH = PUZZLE_HEAD_FILLET;
  // Start mid-neck-top (a straight-edge point, not a corner) so close() needs
  // no corner treatment; every real corner gets the puzzle profile's fillet.
  const profile = draw([0, nH])
    .lineTo([nP, nH])
    .customCorner(fA) // +x armpit (re-entrant neck→head notch)
    .lineTo([nP, hH])
    .customCorner(fH) // +x shoulder
    .lineTo([reach, hH])
    .customCorner(fH) // +x tip
    .lineTo([reach, -hH])
    .customCorner(fH) // +x tip
    .lineTo([nP, -hH])
    .customCorner(fH) // +x shoulder
    .lineTo([nP, -nH])
    .customCorner(fA) // +x armpit
    .lineTo([-nP, -nH])
    .customCorner(fA) // −x armpit
    .lineTo([-nP, -hH])
    .customCorner(fH) // −x shoulder
    .lineTo([-reach, -hH])
    .customCorner(fH) // −x tip
    .lineTo([-reach, hH])
    .customCorner(fH) // −x tip
    .lineTo([-nP, hH])
    .customCorner(fH) // −x shoulder
    .lineTo([-nP, nH])
    .customCorner(fA) // −x armpit
    .close();
  const seated = sketch(profile, 'XY', 0).extrude(-totalHeight);
  const relieved = relieveForNeighborSockets(seated, gridUnitMm);
  if (relieved !== seated) seated.delete();
  const lifted = translate(relieved, [0, 0, totalHeight]);
  relieved.delete();
  return lifted;
}

/**
 * Blind snap-clip pocket on one seam side: a narrow throat (top → ledge) over a
 * wider chamber (ledge → floor). The throat passes the leg but blocks the barb;
 * the barb springs into the chamber and catches the ledge.
 *
 * The throat is cut in three Z-bands so a RETAINING WALL is left solid between
 * the seam and the leg's inner face — the wall the leg bears against to resist
 * pull-apart (the two seam sides' walls meet at the seam, nesting between the
 * clip's prongs):
 *   - bridge recess (top → −BRIDGE_THK): open across the seam so the flush bridge
 *     clears it,
 *   - bearing band (−BRIDGE_THK → bearBottomZ): inner edge stops at `bearWallX`,
 *     leaving the wall solid where the leg root barely flexes,
 *   - lower throat (bearBottomZ → ledge): open to the seam again so the leg tip
 *     can still pinch inward to seat the barb.
 * The chamber below stays open for the sprung barb. Returned as four stacked
 * cutters. Levels come from the shared `snapClipLevels` so pocket, clip, and
 * preview can't drift.
 */
export function makeSnapPocket(
  pt: (wall: number, bp: number) => [number, number],
  w: number,
  bp: number,
  d: -1 | 1,
  lv: SnapClipLevels
): Shape3D[] {
  const ext = COPLANAR_MARGIN;
  const ov = COPLANAR_OVERLAP;
  const br = SNAP_CLIP.BRIDGE_THK;
  const halfL = SNAP_CLIP.LEG_L / 2 + lv.cl;
  // Box from cross-seam depth `innerX`→`outerX` into the piece (innerX = −ext
  // reaches past the seam = open; innerX = bearWallX leaves the retaining wall).
  const rect = (innerX: number, outerX: number) =>
    draw(pt(w - d * innerX, bp + halfL))
      .lineTo(pt(w - d * outerX, bp + halfL))
      .lineTo(pt(w - d * outerX, bp - halfL))
      .lineTo(pt(w - d * innerX, bp - halfL))
      .close();
  // Bridge recess: open across the seam for the flush bridge channel.
  const recess = sketch(rect(-ext, lv.throatDepthX), 'XY', ext).extrude(-(ext + br));
  // Bearing band: inner wall at bearWallX leaves the retaining wall solid.
  const bearing = sketch(rect(lv.bearWallX, lv.throatDepthX), 'XY', -br + ov).extrude(
    lv.bearBottomZ - (-br + ov)
  );
  // Lower throat: open to the seam again so the leg tip can flex inward.
  const lowerThroat = sketch(rect(-ext, lv.throatDepthX), 'XY', lv.bearBottomZ + ov).extrude(
    lv.catchZ - (lv.bearBottomZ + ov)
  );
  // Chamber: ledge → sealed floor, wider outer wall for the sprung barb.
  const chamber = sketch(rect(-ext, lv.chamberDepthX), 'XY', lv.catchZ + ov).extrude(
    -(lv.catchZ + ov + lv.pocketDepth)
  );
  return [recess, bearing, lowerThroat, chamber];
}

/** Per-side gap between a relieved seam part and the nominal seated bin foot (mm). */
const CONNECTOR_SOCKET_RELIEF_GAP = 0.3;

/**
 * Subtract the four bin-foot envelopes flanking a seam junction from a seated
 * connector part (part top at Z=0, junction at the XY origin).
 *
 * The gridfinity socket mouth opens to the FULL cell at the slab top
 * (`INSET_TOP = 0`), so any top-flush part spanning a junction pokes into the
 * open socket corners exactly where a bin foot seats. Each foot envelope is
 * grown by {@link CONNECTOR_SOCKET_RELIEF_GAP}. With `floorZ` set, feet are
 * clipped to the band above it so deeper features (the snap clip's barb/catch
 * zone) are provably untouched; without it the full envelope is subtracted —
 * the socket funnel recedes from the junction with depth, so deeper cuts fall
 * outside a small junction part anyway. Full-cell neighbours are the worst
 * case, so a relieved part clears half-cell, margin, and corner neighbours too.
 * Reuses {@link buildSingleCellSocket} so the relief tracks the real socket
 * profile and can't drift.
 */
function relieveForNeighborSockets(part: Shape3D, gridUnitMm: number, floorZ?: number): Shape3D {
  const footCell = gridUnitMm - CLEARANCE + 2 * CONNECTOR_SOCKET_RELIEF_GAP;
  const half = gridUnitMm / 2;
  // Loft the foot once and clone it to each of the four neighbouring cells.
  const baseFoot = buildSingleCellSocket(footCell, footCell);
  const cutters: ValidSolid[] = [];
  for (const sx of [-1, 1] as const) {
    for (const sy of [-1, 1] as const) {
      const cx = sx * half;
      const cy = sy * half;
      const foot = translate(unwrap(clone(baseFoot)), [cx, cy, 0]);
      if (floorZ === undefined) {
        cutters.push(foot as ValidSolid);
        continue;
      }
      const cap = sketch(
        draw([cx - gridUnitMm, cy - gridUnitMm])
          .lineTo([cx + gridUnitMm, cy - gridUnitMm])
          .lineTo([cx + gridUnitMm, cy + gridUnitMm])
          .lineTo([cx - gridUnitMm, cy + gridUnitMm])
          .close(),
        'XY',
        floorZ
      ).extrude(COPLANAR_MARGIN - floorZ);
      const capped = intersect(foot, cap);
      cap.delete();
      if (isOk(capped)) {
        cutters.push(capped.value as ValidSolid);
        foot.delete();
      } else {
        cutters.push(foot as ValidSolid);
      }
    }
  }
  // cutAll keeps its inputs; free the tools (the caller owns `part`).
  const relieved = unwrap(cutAll(part as ValidSolid, cutters));
  for (const c of cutters) c.delete();
  baseFoot.delete();
  return relieved;
}

/**
 * Carve the clip's top-bridge outer corners back so they clear the bin feet of
 * the edge sockets flanking each seam — ~0.7mm³ per adjacent foot un-relieved,
 * all of it in the top `BRIDGE_THK` band (the deep barb/ledge snap features sit
 * inside the foot's 4mm corner radius and don't interfere). Relief is clipped
 * to the band above the catch ledge so the snap engagement is provably
 * untouched.
 */
function relieveClipForSockets(
  clip: Shape3D,
  totalHeight: number,
  gridUnitMm: number,
  nozzleSizeMm?: number
): Shape3D {
  const lv = snapClipLevels(totalHeight, 0, nozzleSizeMm);
  // Cover the bridge band + margin, but stay clear above the catch ledge so the
  // barb and its catch face are never touched. totalHeight ≥ SOCKET_HEIGHT keeps
  // catchZ ≤ −2.8, so this floor always lands safely above it.
  const floorZ = -(SNAP_CLIP.BRIDGE_THK + 0.8);
  if (floorZ <= lv.catchZ) return clip;
  return relieveForNeighborSockets(clip, gridUnitMm, floorZ);
}

/**
 * Free-standing snap clip ("staple") for `connectorStyle === 'snapClip'`: two
 * legs joined by a flush top bridge with a central flex slot, each leg carrying
 * an outward barb (catch + lead-in) near its tip. Built in SEATED orientation —
 * top face at Z=0, legs hanging to −legBottom — so the preview can place it
 * directly into the seam; the export path rotates it flat for printing.
 *
 * Nominal dimensions (no clearance — the pockets carry it). Cross-section in
 * X-Z, extruded along the seam (Y). The profile carries FDM-balanced edge
 * treatments — flex-slot root fillets (relieve the hinge stress riser), a
 * top-edge chamfer, and slot-mouth fillets — which all sweep into clean vertical
 * walls in the print orientation (no overhang, no print cost); the barb apex,
 * catch face, and leg bearing faces stay crisp. The top-bridge corners are then
 * relieved against the adjacent edge sockets ({@link relieveClipForSockets}) so
 * a seated clip doesn't block bins in the sockets flanking the seam.
 */
export function buildSnapClip(
  totalHeight: number,
  gridUnitMm: number,
  nozzleSizeMm?: number
): Shape3D {
  const lv = snapClipLevels(totalHeight, 0, nozzleSizeMm);
  const g = SNAP_CLIP.GAP_HALF;
  const br = SNAP_CLIP.BRIDGE_THK;
  const { legOuter, barbTip, apexZ, catchZ, leadZ, legBottom } = lv;
  // Profile edge-treatments. The part prints as a constant cross-section prism
  // (silhouette swept along the seam), so every corner here sweeps into a clean
  // vertical wall — no overhang, no FDM print cost. Radii are absolute and the
  // adjacent segments only grow with slab height, so they fit at every height.
  // Kept crisp on purpose: the barb apex + catch face (grip) and the leg outer
  // faces (bearing against the pocket throat).
  const R_TOP = 0.4; // top-edge chamfer — finished push surface, broken edge
  const R_ROOT = 0.4; // flex-slot root fillet — relieves the hinge stress riser
  const R_SLOT = 0.3; // slot-mouth fillet — clean opening, no sharp inner notch
  const profile = draw([-legOuter, 0])
    .lineTo([legOuter, 0])
    .customCorner(R_TOP, 'chamfer')
    .lineTo([legOuter, catchZ])
    .lineTo([barbTip, apexZ])
    .lineTo([legOuter, leadZ])
    .lineTo([legOuter, -legBottom])
    .lineTo([g, -legBottom])
    .customCorner(R_SLOT)
    .lineTo([g, -br])
    .customCorner(R_ROOT)
    .lineTo([-g, -br])
    .customCorner(R_ROOT)
    .lineTo([-g, -legBottom])
    .customCorner(R_SLOT)
    .lineTo([-legOuter, -legBottom])
    .lineTo([-legOuter, leadZ])
    .lineTo([-barbTip, apexZ])
    .lineTo([-legOuter, catchZ])
    .closeWithCustomCorner(R_TOP, 'chamfer');
  const seated = sketch(profile, 'XZ', 0).extrude(SNAP_CLIP.LEG_L);
  const centered = translate(seated, [0, SNAP_CLIP.LEG_L / 2, 0]); // center on the seam axis
  seated.delete(); // translate returns a new shape; free the intermediate
  const relieved = relieveClipForSockets(centered, totalHeight, gridUnitMm, nozzleSizeMm);
  if (relieved !== centered) centered.delete();
  return relieved;
}

/**
 * Snap clip oriented flat on the bed for printing: lay a seam-normal face down
 * so the staple silhouette (barbs + flex slot) prints in-plane with no supports,
 * building up along the clip length. Bottom rests at Z=0.
 */
export function buildSnapClipForPrint(
  totalHeight: number,
  gridUnitMm: number,
  nozzleSizeMm?: number
): Shape3D {
  const seated = buildSnapClip(totalHeight, gridUnitMm, nozzleSizeMm); // top Z=0, legs to −legBottom, length Y∈[−L/2,L/2]
  // Rotate +90° about X (+Y→+Z): a staple-silhouette end face drops onto the
  // bed and the build height becomes the clip length, so barbs/flex print
  // in-plane with no supports. The rotated part centers on Z∈[−L/2,L/2]; lift
  // by L/2 so the bottom rests at Z=0.
  const laid = rotate(seated, 90, { axis: [1, 0, 0] });
  seated.delete();
  const lifted = translate(laid, [0, 0, SNAP_CLIP.LEG_L / 2]);
  laid.delete();
  return lifted;
}
