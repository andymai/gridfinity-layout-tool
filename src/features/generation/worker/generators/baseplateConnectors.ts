/**
 * Inter-piece connectors at grid cell boundary intersections along join edges.
 *
 * Two styles are supported, dispatched by `connectorStyle`:
 *
 * - 'dovetail': trapezoidal prism — narrower at the wall (BASE_HALF), wider
 *   at the tip (TIP_HALF). The taper is in the X-Y plane so pieces drop in
 *   from above. Once seated, the tip blocks horizontal pull-out.
 * - 'snap': rabbit-clip socket pockets cut into each piece's seam edge. A
 *   separately-printed flat clip slides in laterally — its flexing ears
 *   snap past the socket waist and lock into the wider mid-section, joining
 *   the two pieces. See snapClipBuilder.ts.
 *
 * Convention (dovetail only): left/front = tongue (male, fused), right/back =
 * groove (female, cut). Inverted by `invertDovetails`.
 *
 * All profiles are drawn on the XY plane (normal=+Z) and extruded downward,
 * matching the pre-Z-shift coordinate system (slab top at Z=0, bottom at
 * Z=-totalHeight).
 */

import { draw, rotate, translate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BaseplateParams } from '@/shared/types/bin';
import { resolveConnectorStyle } from '@/shared/types/bin';
import {
  TONGUE_PROTRUSION,
  TONGUE_BASE_HALF,
  TONGUE_TIP_HALF,
  TONGUE_CLEARANCE,
  COPLANAR_MARGIN,
  COPLANAR_OVERLAP,
  SNAP_CLIP_DEPTH,
  SNAP_CLIP_DEPTH_CLEARANCE,
  sketch,
  cellCentersAlong,
} from './generatorTypes';
import { buildSnapSocketCutter } from './snapClipBuilder';

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
  const { edges, invertDovetails, preferIdenticalPieces } = params;
  const style = resolveConnectorStyle(params);
  const tongues: Shape3D[] = [];
  const grooves: Shape3D[] = [];

  if (style === 'none' || !edges) return { nubs: tongues, holes: grooves };

  if (style === 'snap') {
    return {
      nubs: tongues,
      holes: buildSnapCutters(params, totalHeight, totalW, totalD, slabOffsetX, slabOffsetY),
    };
  }

  const invert = !!invertDovetails;
  // In paired mode invertDovetails is intentionally ignored — the layout is
  // 180°-rotationally symmetric by construction, so an "invert" toggle would
  // produce the same physical connector orientation on both sides.
  const paired = !!preferIdenticalPieces;

  const halfW = totalW / 2;
  const halfD = totalD / 2;
  const gridUnit = params.gridUnitMm;
  const P = TONGUE_PROTRUSION;
  const bW = TONGUE_BASE_HALF; // half-width at wall (narrow)
  const tW = TONGUE_TIP_HALF; // half-width at tip (wide)
  const cl = TONGUE_CLEARANCE;
  const ext = COPLANAR_MARGIN;

  const yCenters = cellCentersAlong(params.depth, gridUnit, params.fractionalEdgeY);
  const xCenters = cellCentersAlong(params.width, gridUnit, params.fractionalEdgeX);

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
    centers: readonly number[];
    protrudeAxis: 'x' | 'y';
    protrudeDir: -1 | 1;
  }> = [
    {
      side: 'left',
      isMale: !invert,
      maleOffsetSign: 1,
      wallPos: -halfW + slabOffsetX,
      centers: yCenters,
      protrudeAxis: 'x',
      protrudeDir: -1,
    },
    {
      side: 'right',
      isMale: invert,
      maleOffsetSign: -1,
      wallPos: halfW + slabOffsetX,
      centers: yCenters,
      protrudeAxis: 'x',
      protrudeDir: 1,
    },
    {
      side: 'front',
      isMale: !invert,
      maleOffsetSign: -1,
      wallPos: -halfD + slabOffsetY,
      centers: xCenters,
      protrudeAxis: 'y',
      protrudeDir: -1,
    },
    {
      side: 'back',
      isMale: invert,
      maleOffsetSign: 1,
      wallPos: halfD + slabOffsetY,
      centers: xCenters,
      protrudeAxis: 'y',
      protrudeDir: 1,
    },
  ];

  for (const def of edgeDefs) {
    if (edges[def.side] !== 'join') continue;

    // Build an XY point with wall/cell-center coords assigned to the correct
    // axis. When protruding along X, wall is on X and cell-center is on Y;
    // vice versa for Y.
    const pt =
      def.protrudeAxis === 'x'
        ? (wallCoord: number, bpCoord: number): [number, number] => [wallCoord, bpCoord]
        : (wallCoord: number, bpCoord: number): [number, number] => [bpCoord, wallCoord];

    for (const bp of def.centers) {
      const w = def.wallPos;
      const d = def.protrudeDir;

      if (paired) {
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

// Rabbit-clip sockets: one pocket per cell-boundary along each join edge.
// The pocket's outline matches the clip pin's silhouette (+ clearance) so the
// clip's ears compress on insertion and snap into the wider mid-section.
// The pocket is carved into the slab top and opens laterally at the seam
// edge — the clip slides in from the seam direction, not from above.
function buildSnapCutters(
  params: BaseplateParams,
  totalHeight: number,
  totalW: number,
  totalD: number,
  slabOffsetX: number,
  slabOffsetY: number
): Shape3D[] {
  const { edges } = params;
  const holes: Shape3D[] = [];
  if (!edges) return holes;

  const halfW = totalW / 2;
  const halfD = totalD / 2;
  const gridUnit = params.gridUnitMm;

  const yCenters = cellCentersAlong(params.depth, gridUnit, params.fractionalEdgeY);
  const xCenters = cellCentersAlong(params.width, gridUnit, params.fractionalEdgeX);

  // Pocket is centered vertically in the slab so the clip is hidden in both
  // top and bottom views, with at least 1 mm of slab material above and below.
  const cutterDepth = SNAP_CLIP_DEPTH + SNAP_CLIP_DEPTH_CLEARANCE;
  const zCenter = -totalHeight / 2;
  const zBottom = zCenter - cutterDepth / 2;

  type Side = 'left' | 'right' | 'front' | 'back';
  // Canonical socket cutter has its pin base at local Y=0 extending toward
  // +Y. `rotZ` rotates it so the pin extends *inward* from the seam edge.
  const edgeDefs: ReadonlyArray<{
    side: Side;
    wallPos: number;
    bpAxis: 'x' | 'y';
    rotZ: number;
    centers: readonly number[];
  }> = [
    { side: 'left', wallPos: -halfW + slabOffsetX, bpAxis: 'y', rotZ: -90, centers: yCenters },
    { side: 'right', wallPos: halfW + slabOffsetX, bpAxis: 'y', rotZ: 90, centers: yCenters },
    { side: 'front', wallPos: -halfD + slabOffsetY, bpAxis: 'x', rotZ: 0, centers: xCenters },
    { side: 'back', wallPos: halfD + slabOffsetY, bpAxis: 'x', rotZ: 180, centers: xCenters },
  ];

  for (const def of edgeDefs) {
    if (edges[def.side] !== 'join') continue;
    for (const bp of def.centers) {
      const cutter = buildSnapSocketCutter();
      const rotated = def.rotZ === 0 ? cutter : rotate(cutter, def.rotZ, { axis: [0, 0, 1] });
      const wx = def.bpAxis === 'y' ? def.wallPos : bp;
      const wy = def.bpAxis === 'y' ? bp : def.wallPos;
      holes.push(translate(rotated, [wx, wy, zBottom]));
    }
  }

  return holes;
}
