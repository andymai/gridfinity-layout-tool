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
  COPLANAR_MARGIN,
  COPLANAR_OVERLAP,
  sketch,
} from './generatorTypes';

export function buildConnectors(
  params: BaseplateParams,
  totalHeight: number,
  totalW: number,
  totalD: number,
  slabOffsetX: number,
  slabOffsetY: number
): { nubs: Shape3D[]; holes: Shape3D[] } {
  const { edges, connectorNubs, invertDovetails } = params;
  const tongues: Shape3D[] = [];
  const grooves: Shape3D[] = [];

  if (!connectorNubs || !edges) return { nubs: tongues, holes: grooves };

  const invert = !!invertDovetails;

  const halfW = totalW / 2;
  const halfD = totalD / 2;
  const gridUnit = params.gridUnitMm;
  const P = TONGUE_PROTRUSION;
  const bW = TONGUE_BASE_HALF; // half-width at wall (narrow)
  const tW = TONGUE_TIP_HALF; // half-width at tip (wide)
  const cl = TONGUE_CLEARANCE;
  const ext = COPLANAR_MARGIN;

  type Side = 'left' | 'right' | 'front' | 'back';

  const edgeDefs: ReadonlyArray<{
    side: Side;
    isMale: boolean;
    wallPos: number;
    numBoundaries: number;
    boundaryPos: (k: number) => number;
    protrudeAxis: 'x' | 'y';
    protrudeDir: -1 | 1;
  }> = [
    {
      side: 'left',
      isMale: !invert,
      wallPos: -halfW + slabOffsetX,
      numBoundaries: Math.ceil(params.depth) - 1,
      boundaryPos: (k) => k * gridUnit - (params.depth * gridUnit) / 2,
      protrudeAxis: 'x',
      protrudeDir: -1,
    },
    {
      side: 'right',
      isMale: invert,
      wallPos: halfW + slabOffsetX,
      numBoundaries: Math.ceil(params.depth) - 1,
      boundaryPos: (k) => k * gridUnit - (params.depth * gridUnit) / 2,
      protrudeAxis: 'x',
      protrudeDir: 1,
    },
    {
      side: 'front',
      isMale: !invert,
      wallPos: -halfD + slabOffsetY,
      numBoundaries: Math.ceil(params.width) - 1,
      boundaryPos: (k) => k * gridUnit - (params.width * gridUnit) / 2,
      protrudeAxis: 'y',
      protrudeDir: -1,
    },
    {
      side: 'back',
      isMale: invert,
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
      const bp = def.boundaryPos(k); // boundary position on parallel axis
      const w = def.wallPos;
      const d = def.protrudeDir;

      if (def.isMale) {
        // Dovetail tongue: trapezoidal plan view, wider at tip.
        // The base edge is extended COPLANAR_OVERLAP into the slab so the fuse
        // has shared volume rather than a degenerate coplanar interface at the
        // wall face. Coplanar fuses cause OCCT to produce non-manifold topology,
        // which slicers repair as solid infill (issue #1407).
        const profile = draw(pt(w - d * COPLANAR_OVERLAP, bp + bW))
          .lineTo(pt(w + d * P, bp + tW))
          .lineTo(pt(w + d * P, bp - tW))
          .lineTo(pt(w - d * COPLANAR_OVERLAP, bp - bW))
          .close();
        tongues.push(sketch(profile, 'XY', 0).extrude(-totalHeight));
      } else {
        // Dovetail groove: matching shape + clearance, extended beyond wall.
        const gB = bW + cl; // half-width at wall opening (narrow + clearance)
        const gT = tW + cl; // half-width at inner face (wide + clearance)
        const gP = P + cl; // groove depth
        const profile = draw(pt(w + d * ext, bp + gB))
          .lineTo(pt(w - d * gP, bp + gT))
          .lineTo(pt(w - d * gP, bp - gT))
          .lineTo(pt(w + d * ext, bp - gB))
          .close();
        // Extend groove in Z beyond slab faces to avoid coplanar booleans
        grooves.push(
          sketch(profile, 'XY', COPLANAR_MARGIN).extrude(-(totalHeight + 2 * COPLANAR_MARGIN))
        );
      }
    }
  }

  return { nubs: tongues, holes: grooves };
}
