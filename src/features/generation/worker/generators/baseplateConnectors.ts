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

import { draw } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BaseplateParams } from '@/shared/types/bin';
import {
  TONGUE_PROTRUSION,
  TONGUE_BASE_HALF,
  TONGUE_TIP_HALF,
  TONGUE_CLEARANCE,
  DOVETAIL_KEY_CLEARANCE,
  COPLANAR_MARGIN,
  COPLANAR_OVERLAP,
  sketch,
} from './generatorTypes';
import { computeCellBoundariesMm } from './cellDecomposition';

/**
 * Half the separation between the tongue and groove of a paired connector,
 * measured along the edge axis. Paired connectors sit at `bp ± PAIR_HALF_OFFSET`
 * around each cell boundary.
 *
 * Sized so the two feature footprints (tip half-width ≈ 1.45 mm including
 * clearance) plus a comfortable gap fit inside a single grid cell (42 mm).
 */
const PAIR_HALF_OFFSET = 4;

export function buildConnectors(
  params: BaseplateParams,
  totalHeight: number,
  totalW: number,
  totalD: number,
  slabOffsetX: number,
  slabOffsetY: number
): { nubs: Shape3D[]; holes: Shape3D[] } {
  const { edges, connectorNubs, invertDovetails, preferIdenticalPieces } = params;
  const tongues: Shape3D[] = [];
  const grooves: Shape3D[] = [];

  if (!connectorNubs || !edges) return { nubs: tongues, holes: grooves };

  // Dovetail key mode: every join edge is a female groove (no tongues), and a
  // separate hammered-in key spans the seam. Handedness toggles (invert /
  // paired) are meaningless when both sides are female, so they're bypassed.
  const isDovetailKey = params.connectorStyle === 'dovetailKey';

  const invert = !!invertDovetails && !isDovetailKey;
  // In paired mode invertDovetails is intentionally ignored — the layout is
  // 180°-rotationally symmetric by construction, so an "invert" toggle would
  // produce the same physical connector orientation on both sides.
  const paired = !!preferIdenticalPieces && !isDovetailKey;

  const halfW = totalW / 2;
  const halfD = totalD / 2;
  const gridUnit = params.gridUnitMm;
  const P = TONGUE_PROTRUSION;
  const bW = TONGUE_BASE_HALF; // half-width at wall (narrow)
  const tW = TONGUE_TIP_HALF; // half-width at tip (wide)
  const cl = isDovetailKey ? DOVETAIL_KEY_CLEARANCE : TONGUE_CLEARANCE;
  const ext = COPLANAR_MARGIN;

  // Honors fractionalEdgeX/Y so dovetails land on cell boundaries even when
  // the half-cell is at the start (rotated piece under preferIdenticalPieces).
  const yBoundaries = computeCellBoundariesMm(params.depth, gridUnit, params.fractionalEdgeY);
  const xBoundaries = computeCellBoundariesMm(params.width, gridUnit, params.fractionalEdgeX);

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
    protrudeAxis: 'x' | 'y';
    protrudeDir: -1 | 1;
  }> = [
    {
      side: 'left',
      isMale: !invert,
      maleOffsetSign: 1,
      wallPos: -halfW + slabOffsetX,
      boundaries: yBoundaries,
      protrudeAxis: 'x',
      protrudeDir: -1,
    },
    {
      side: 'right',
      isMale: invert,
      maleOffsetSign: -1,
      wallPos: halfW + slabOffsetX,
      boundaries: yBoundaries,
      protrudeAxis: 'x',
      protrudeDir: 1,
    },
    {
      side: 'front',
      isMale: !invert,
      maleOffsetSign: -1,
      wallPos: -halfD + slabOffsetY,
      boundaries: xBoundaries,
      protrudeAxis: 'y',
      protrudeDir: -1,
    },
    {
      side: 'back',
      isMale: invert,
      maleOffsetSign: 1,
      wallPos: halfD + slabOffsetY,
      boundaries: xBoundaries,
      protrudeAxis: 'y',
      protrudeDir: 1,
    },
  ];

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

      if (isDovetailKey) {
        // Both sides of every seam are female; the key supplies the male half.
        grooves.push(makeGroove(pt, w, bp, d, P, bW, tW, cl, ext, totalHeight));
      } else if (paired) {
        const mBp = bp + def.maleOffsetSign * PAIR_HALF_OFFSET;
        const fBp = bp - def.maleOffsetSign * PAIR_HALF_OFFSET;
        tongues.push(makeTongue(pt, w, mBp, d, P, bW, tW, totalHeight));
        grooves.push(makeGroove(pt, w, fBp, d, P, bW, tW, cl, ext, totalHeight));
      } else if (def.isMale) {
        tongues.push(makeTongue(pt, w, bp, d, P, bW, tW, totalHeight));
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
function makeTongue(
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
function makeGroove(
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
