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
 * Dovetail-key style (`connectorStyle === 'dovetailKey'`): every join edge is female
 * (groove only, no tongue), and a separate `buildDovetailKey()` part is hammered
 * into the seam. Two opposing grooves across a seam form one dovetail key cavity —
 * narrow at the seam, wide into each piece — that the key locks into. The
 * groove uses the tighter `DOVETAIL_KEY_CLEARANCE` for a press fit. `invertDovetails`
 * and `preferIdenticalPieces` are ignored in this mode (seams are symmetric).
 *
 * All profiles are drawn on the XY plane (normal=+Z) and extruded downward,
 * matching the pre-Z-shift coordinate system (slab top at Z=0, bottom at
 * Z=-totalHeight).
 */

import { draw, rotate, translate, intersect, cutAll, clone } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { BaseplateParams } from '@/shared/types/bin';
import { isOk, unwrap } from '@/core/result';
import {
  TONGUE_PROTRUSION,
  TONGUE_BASE_HALF,
  TONGUE_TIP_HALF,
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
import { computeCellBoundariesMm, decomposeCells } from './cellDecomposition';
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
  // Tongue half-width at the tip plus its groove clearance and a small margin —
  // the boundary-axis reach over which a neighbour socket can touch the tongue.
  const reach = TONGUE_TIP_HALF + TONGUE_CLEARANCE + 0.5;
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
  params: BaseplateParams,
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

  if (!connectorNubs || !edges) return { nubs: tongues, holes: grooves };

  // Dovetail key & snap clip modes: every join edge is female (a groove / a
  // blind ledged pocket, no tongues), and a separate part spans the seam.
  // Handedness toggles (invert / paired) are meaningless when both sides are
  // female, so they're bypassed for both.
  const isDovetailKey = params.connectorStyle === 'dovetailKey';
  const isSnapClip = params.connectorStyle === 'snapClip';
  const bothFemale = isDovetailKey || isSnapClip;

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
      boundaryCells: xCellSpans,
      protrudeAxis: 'y',
      protrudeDir: 1,
    },
  ];

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

  for (const def of edgeDefs) {
    if (edges[def.side] !== 'join' || def.boundaries.length === 0) continue;

    // Build an XY point with wall/boundary coords assigned to the correct axis.
    // When protruding along X, wall is on X and boundary is on Y; vice versa for Y.
    const pt =
      def.protrudeAxis === 'x'
        ? (wallCoord: number, bpCoord: number): [number, number] => [wallCoord, bpCoord]
        : (wallCoord: number, bpCoord: number): [number, number] => [bpCoord, wallCoord];

    for (const bp of def.boundaries) {
      const w = def.wallPos;
      const d = def.protrudeDir;

      if (isSnapClip && snapLevels) {
        // Both sides of every seam are blind ledged pockets; the snap clip
        // supplies the male half. Throat + chamber cut as two stacked cutters.
        grooves.push(...makeSnapPocket(pt, w, bp, d, snapLevels));
      } else if (isDovetailKey) {
        // Both sides of every seam are female; the key supplies the male half.
        grooves.push(makeGroove(pt, w, bp, d, P, bW, tW, cl, ext, totalHeight));
      } else if (paired) {
        const mBp = bp + def.maleOffsetSign * PAIR_HALF_OFFSET;
        const fBp = bp - def.maleOffsetSign * PAIR_HALF_OFFSET;
        tongues.push(relieveTongue(makeTongue(pt, w, mBp, d, P, bW, tW, totalHeight), mBp, def));
        grooves.push(makeGroove(pt, w, fBp, d, P, bW, tW, cl, ext, totalHeight));
      } else if (def.isMale) {
        tongues.push(relieveTongue(makeTongue(pt, w, bp, d, P, bW, tW, totalHeight), bp, def));
      } else {
        grooves.push(makeGroove(pt, w, bp, d, P, bW, tW, cl, ext, totalHeight));
      }
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
 * Free-standing dovetail key for `connectorStyle === 'dovetailKey'`: two dovetail
 * tongues mirrored across the waist into one prism, centered on the origin with
 * its long axis along X. Narrow at the waist (`TONGUE_BASE_HALF`, sits at the
 * seam), wide at both wing tips (`TONGUE_TIP_HALF`, captured inside each piece).
 *
 * Built at nominal tongue dimensions — the seam grooves carry
 * `DOVETAIL_KEY_CLEARANCE`, so the per-face gap to the pocket comes from there.
 * Extruded upward so the bottom sits at Z=0 (bed-ready); full height matches the
 * plate's `totalHeight` so the seated key is flush with the plate top.
 */
export function buildDovetailKey(totalHeight: number): Shape3D {
  const P = TONGUE_PROTRUSION;
  const bW = TONGUE_BASE_HALF;
  const tW = TONGUE_TIP_HALF;
  const profile = draw([-P, tW])
    .lineTo([0, bW])
    .lineTo([P, tW])
    .lineTo([P, -tW])
    .lineTo([0, -bW])
    .lineTo([-P, -tW])
    .close();
  return sketch(profile, 'XY', 0).extrude(totalHeight);
}

/**
 * Blind snap-clip pocket on one seam side: a narrow throat (top → ledge) over a
 * wider chamber (ledge → floor). The throat passes the leg but blocks the barb;
 * the barb springs into the chamber and catches the ledge. Returned as two
 * stacked cutters (throat, chamber) to subtract from the slab. Mirror of the
 * snap clip's leg cross-section; pocket carries the clearance.
 *
 * Levels come from the shared `snapClipLevels` so the pocket, the clip, and the
 * seated-clip preview can't drift. Proven standalone with brepjs-verify: at the
 * thin 5mm slab the seated clip clears the pockets with zero interference.
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
  const halfL = SNAP_CLIP.LEG_L / 2 + lv.cl;
  const rect = (depthX: number) =>
    draw(pt(w + d * ext, bp + halfL))
      .lineTo(pt(w - d * depthX, bp + halfL))
      .lineTo(pt(w - d * depthX, bp - halfL))
      .lineTo(pt(w + d * ext, bp - halfL))
      .close();
  // Throat: from just above the top (Z=+margin) down to the ledge (Z=catchZ).
  const throat = sketch(rect(lv.throatDepthX), 'XY', ext).extrude(-(ext - lv.catchZ));
  // Chamber: from just above the ledge down to the pocket floor (sealed).
  const chamber = sketch(rect(lv.chamberDepthX), 'XY', lv.catchZ + ov).extrude(
    -(lv.catchZ + ov + lv.pocketDepth)
  );
  return [throat, chamber];
}

/** Per-side gap between the relieved clip and the nominal seated bin foot (mm). */
const SNAP_CLIP_SOCKET_RELIEF_GAP = 0.3;

/**
 * Carve the clip's top-bridge outer corners back so they clear the bin feet of
 * the edge sockets flanking each seam.
 *
 * The gridfinity socket mouth opens to the FULL cell at the slab top
 * (`INSET_TOP = 0`), so a top-inserted staple's flush bridge otherwise pokes
 * into the open socket corners exactly where a bin foot seats — ~0.7mm³ per
 * adjacent foot, all of it in the top `BRIDGE_THK` band (the deep barb/ledge
 * snap features sit inside the foot's 4mm corner radius and don't interfere).
 *
 * The relief subtracts the four neighbouring full-cell foot envelopes (grown by
 * {@link SNAP_CLIP_SOCKET_RELIEF_GAP}) but only ABOVE the catch ledge, so the
 * snap engagement is provably untouched. Full-cell neighbours are the worst
 * case, so the single printed clip part clears half-cell, margin, and corner
 * neighbours too. Reuses {@link buildSingleCellSocket} so the relief tracks the
 * real socket profile and can't drift.
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

  const footCell = gridUnitMm - CLEARANCE + 2 * SNAP_CLIP_SOCKET_RELIEF_GAP;
  const half = gridUnitMm / 2;
  // Loft the foot once and clone it to each of the four neighbouring cells.
  const baseFoot = buildSingleCellSocket(footCell, footCell);
  const cutters: ValidSolid[] = [];
  for (const sx of [-1, 1] as const) {
    for (const sy of [-1, 1] as const) {
      const cx = sx * half;
      const cy = sy * half;
      const foot = translate(unwrap(clone(baseFoot)), [cx, cy, 0]);
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
  // cutAll keeps its inputs; free the tools (the caller owns `clip`).
  const relieved = unwrap(cutAll(clip as ValidSolid, cutters));
  for (const c of cutters) c.delete();
  baseFoot.delete();
  return relieved;
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
