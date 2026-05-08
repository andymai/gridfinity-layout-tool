/**
 * Inter-piece connectors at grid cell boundary intersections along join edges.
 *
 * Two styles are supported, dispatched by `connectorStyle`:
 *
 * - 'dovetail': trapezoidal prism — narrower at the wall (BASE_HALF), wider
 *   at the tip (TIP_HALF). The taper is in the X-Y plane so pieces drop in
 *   from above. Once seated, the tip blocks horizontal pull-out.
 * - 'snap': cylindrical through-holes for a separately printed U-clip. Holes
 *   are inset `SNAP_PRONG_INSET` from the seam (one per piece). The clip
 *   bridges the seam from above and locks via tip barbs below the slab.
 *
 * Convention (dovetail only): left/front = tongue (male, fused), right/back =
 * groove (female, cut). Inverted by `invertDovetails`.
 *
 * All profiles are drawn on the XY plane (normal=+Z) and extruded downward,
 * matching the pre-Z-shift coordinate system (slab top at Z=0, bottom at
 * Z=-totalHeight).
 */

import { box, draw, drawCircle, translate } from 'brepjs';
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
  SNAP_HOLE_DIAMETER,
  SNAP_PEG_INSET,
  SNAP_HOLE_DEPTH,
  SNAP_SADDLE_WIDTH,
  SNAP_SADDLE_LENGTH_MARGIN,
  SNAP_RECESS_CLEARANCE,
  SNAP_RECESS_DEPTH,
  sketch,
} from './generatorTypes';

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
    numBoundaries: number;
    boundaryPos: (k: number) => number;
    protrudeAxis: 'x' | 'y';
    protrudeDir: -1 | 1;
  }> = [
    {
      side: 'left',
      isMale: !invert,
      maleOffsetSign: 1,
      wallPos: -halfW + slabOffsetX,
      numBoundaries: Math.ceil(params.depth) - 1,
      boundaryPos: (k) => k * gridUnit - (params.depth * gridUnit) / 2,
      protrudeAxis: 'x',
      protrudeDir: -1,
    },
    {
      side: 'right',
      isMale: invert,
      maleOffsetSign: -1,
      wallPos: halfW + slabOffsetX,
      numBoundaries: Math.ceil(params.depth) - 1,
      boundaryPos: (k) => k * gridUnit - (params.depth * gridUnit) / 2,
      protrudeAxis: 'x',
      protrudeDir: 1,
    },
    {
      side: 'front',
      isMale: !invert,
      maleOffsetSign: -1,
      wallPos: -halfD + slabOffsetY,
      numBoundaries: Math.ceil(params.width) - 1,
      boundaryPos: (k) => k * gridUnit - (params.width * gridUnit) / 2,
      protrudeAxis: 'y',
      protrudeDir: -1,
    },
    {
      side: 'back',
      isMale: invert,
      maleOffsetSign: 1,
      wallPos: halfD + slabOffsetY,
      numBoundaries: Math.ceil(params.width) - 1,
      boundaryPos: (k) => k * gridUnit - (params.width * gridUnit) / 2,
      protrudeAxis: 'y',
      protrudeDir: 1,
    },
  ];

  for (const def of edgeDefs) {
    if (edges[def.side] !== 'join' || def.numBoundaries <= 0) continue;

    // Build an XY point with wall/boundary coords assigned to the correct axis.
    // When protruding along X, wall is on X and boundary is on Y; vice versa for Y.
    const pt =
      def.protrudeAxis === 'x'
        ? (wallCoord: number, bpCoord: number): [number, number] => [wallCoord, bpCoord]
        : (wallCoord: number, bpCoord: number): [number, number] => [bpCoord, wallCoord];

    for (let k = 1; k <= def.numBoundaries; k++) {
      const bp = def.boundaryPos(k);
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

// Snap cutters are shallow blind holes drilled into the slab top: two per
// grid boundary along a join edge, straddling the seam at ±SNAP_PEG_INSET.
// The saddle clip drops onto these from above.
function buildSnapCutters(
  params: BaseplateParams,
  _totalHeight: number,
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
  const radius = SNAP_HOLE_DIAMETER / 2;
  const ext = COPLANAR_MARGIN;

  type Side = 'left' | 'right' | 'front' | 'back';
  const edgeDefs: ReadonlyArray<{
    side: Side;
    wallPos: number;
    inward: -1 | 1;
    protrudeAxis: 'x' | 'y';
    numBoundaries: number;
    boundaryPos: (k: number) => number;
  }> = [
    {
      side: 'left',
      wallPos: -halfW + slabOffsetX,
      inward: 1,
      protrudeAxis: 'x',
      numBoundaries: Math.ceil(params.depth) - 1,
      boundaryPos: (k) => k * gridUnit - (params.depth * gridUnit) / 2,
    },
    {
      side: 'right',
      wallPos: halfW + slabOffsetX,
      inward: -1,
      protrudeAxis: 'x',
      numBoundaries: Math.ceil(params.depth) - 1,
      boundaryPos: (k) => k * gridUnit - (params.depth * gridUnit) / 2,
    },
    {
      side: 'front',
      wallPos: -halfD + slabOffsetY,
      inward: 1,
      protrudeAxis: 'y',
      numBoundaries: Math.ceil(params.width) - 1,
      boundaryPos: (k) => k * gridUnit - (params.width * gridUnit) / 2,
    },
    {
      side: 'back',
      wallPos: halfD + slabOffsetY,
      inward: -1,
      protrudeAxis: 'y',
      numBoundaries: Math.ceil(params.width) - 1,
      boundaryPos: (k) => k * gridUnit - (params.width * gridUnit) / 2,
    },
  ];

  // Saddle recess: half on each piece, hugging the seam; clip's flat shoulder
  // sits flush so only the arch projects above the slab top.
  const recessAcrossLen = SNAP_PEG_INSET + SNAP_SADDLE_LENGTH_MARGIN + SNAP_RECESS_CLEARANCE;
  const recessAlongLen = SNAP_SADDLE_WIDTH + 2 * SNAP_RECESS_CLEARANCE;
  const recessHeight = SNAP_RECESS_DEPTH + ext;
  const recessZCenter = -SNAP_RECESS_DEPTH / 2 + ext / 2;

  // Blind peg holes; ext on top avoids degenerate coplanar booleans.
  const holeDepth = SNAP_RECESS_DEPTH + SNAP_HOLE_DEPTH + ext;

  for (const def of edgeDefs) {
    if (edges[def.side] !== 'join' || def.numBoundaries <= 0) continue;
    const xAxis = def.protrudeAxis === 'x';
    const peg = def.wallPos + def.inward * SNAP_PEG_INSET;
    const recessAcrossCenter = def.wallPos + def.inward * (recessAcrossLen / 2);
    const recessW = xAxis ? recessAcrossLen : recessAlongLen;
    const recessD = xAxis ? recessAlongLen : recessAcrossLen;

    for (let k = 1; k <= def.numBoundaries; k++) {
      const bp = def.boundaryPos(k);
      const cx = xAxis ? peg : bp;
      const cy = xAxis ? bp : peg;
      const cylinder = drawCircle(radius).sketchOnPlane('XY', ext).extrude(-holeDepth) as Shape3D;
      holes.push(translate(cylinder, [cx, cy, 0]));

      const recessCx = xAxis ? recessAcrossCenter : bp;
      const recessCy = xAxis ? bp : recessAcrossCenter;
      holes.push(
        box(recessW, recessD, recessHeight, {
          at: [recessCx, recessCy, recessZCenter],
        })
      );
    }
  }

  return holes;
}
