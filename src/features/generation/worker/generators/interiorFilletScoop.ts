/**
 * The interior fillet in a compartment with finger scoops.
 *
 * The scoop's own ramps are cut out of the compartment's air first, so one
 * fillet runs along the floor, up the ramp where it meets a side wall and on up
 * the corner above it. The grown air then carries the ramp too: this feature
 * builds the ramps it climbs, and the scoop feature leaves them out.
 */

import {
  box,
  classifyPointOnFace,
  curvePointAt,
  curveTangentAt,
  cut,
  faceGeomType,
  facesOfEdge,
  fillet,
  fuseAll,
  getBounds,
  getEdges,
  isOk,
  normalAt,
  setShapeOrigin,
  unwrap,
} from 'brepjs';
import type { DisposalScope, Edge, Face, Shape3D, ValidSolid } from 'brepjs';
import type { ScoopSide } from '@/shared/types/bin';
import type { CompartmentFilletPlan, FilletPt } from './interiorFilletPlan';
import { buildScoopRampSolids } from './scoopRampBuilder';
import type { ScoopRampSolid } from './scoopRampBuilder';
import { FeatureTag } from './featureTags';
import {
  CUTTER_OVERSHOOT_MM,
  EDGE_TOL_MM,
  filletWithRetry,
  leans,
  roundingMaterial,
} from './interiorFilletGeometry';
import type { InteriorFilletBuild } from './interiorFilletBuilder';

export interface CompartmentRamps {
  readonly solid: Shape3D;
  readonly sides: ReadonlySet<ScoopSide>;
  readonly top: number;
}

/**
 * The ramps this feature climbs, fused per compartment and keyed by its id.
 * Their faces carry the scoop's tag, which the cuts and the fillet below keep.
 */
export function climbedRamps(
  scope: DisposalScope,
  input: InteriorFilletBuild,
  raises: ReadonlyMap<number, number>
): Map<number, CompartmentRamps> {
  const { params, dimensions: dim } = input;
  const byCompartment = new Map<number, ScoopRampSolid[]>();
  for (const ramp of buildScoopRampSolids(
    scope,
    params,
    dim.innerW,
    dim.innerD,
    dim.wallHeight,
    params.wallThickness,
    dim.floorThickness,
    (id) => raises.get(id) ?? 0,
    dim.overhang.taper
  )) {
    if (!ramp.climbed) continue;
    byCompartment.set(ramp.compId, [...(byCompartment.get(ramp.compId) ?? []), ramp]);
  }
  const out = new Map<number, CompartmentRamps>();
  for (const [id, ramps] of byCompartment) {
    const solid =
      ramps.length === 1
        ? ramps[0].solid
        : scope.register(unwrap(fuseAll(ramps.map((r) => r.solid) as ValidSolid[])));
    setShapeOrigin(solid, FeatureTag.SCOOP);
    out.set(id, { solid, sides: new Set(ramps.map((r) => r.side)), top: getBounds(solid).zMax });
  }
  return out;
}

/**
 * The fillet for a compartment whose floor carries climbed ramps, the ramps
 * included up to the fillet's top, or null when OCCT cannot round it (the
 * caller then builds the plain fillet and the ramps as they are).
 *
 * A corner between a scooped and an unscooped wall is drawn sharp: the fillet
 * that climbs the ramp along the unscooped wall carries straight on up that
 * corner, one smooth chain. A corner between two scooped walls keeps its arc,
 * since the ramps meet there in a valley no fillet chain runs through.
 */
export function buildScoopedCompartmentFillet(
  scope: DisposalScope,
  plan: CompartmentFilletPlan,
  pen: number,
  ramps: CompartmentRamps,
  wallHeight: number
): Shape3D | null {
  // The air is a vertical box, so a compartment whose walls lean (a tapered
  // outer wall beside the scooped one) is left to the plain fillet.
  if (plan.floor.length !== 4 || plan.holes.length > 0 || leans(plan.floor, plan.top)) return null;
  const sidesAt = rectangleSides(plan.floor);
  const keepsArc = plan.floor.map(
    (_, i) => sidesAt[i].filter((side) => ramps.sides.has(side)).length !== 1
  );
  // Below the stacking lip's seat the ramp's lip filler ends in a ledge; the air
  // stops short of it so no sliver of that ledge enters the fillet.
  const headroom = wallHeight - plan.zTop;
  const zCut =
    plan.zTop + (headroom > 0 ? Math.min(CUTTER_OVERSHOOT_MM, headroom / 2) : CUTTER_OVERSHOOT_MM);
  try {
    const drawn = boxAir(plan, zCut, keepsArc);
    if (!drawn) return null;
    const block = scope.register(drawn);
    const air = scope.register(unwrap(cut(block as ValidSolid, ramps.solid as ValidSolid)));
    const edges = junctionEdges(air, plan.zFloor, plan.zTop);
    if (edges.length === 0) return null;
    const rounded = filletWithRetry(scope, air, edges, plan.radius);
    if (!rounded) return null;
    // The ramp stays in the material rather than coming from a second solid:
    // the body fuse meeting the same curved faces twice is slow, and cutting
    // them back out of this one is too.
    return roundingMaterial(scope, plan, pen, rounded);
  } catch {
    return null;
  }
}

/** How far the ramps' cap reaches down into the fillet, so the two overlap. */
const CAP_OVERLAP_MM = 0.5;

/**
 * The part of the ramps standing above the fillet's top, the lip filler behind
 * a lipped wall, or null when they stop below it.
 */
export function rampCap(
  scope: DisposalScope,
  plan: CompartmentFilletPlan,
  ramps: CompartmentRamps
): Shape3D | null {
  if (ramps.top <= plan.zTop + EDGE_TOL_MM) return null;
  const b = getBounds(ramps.solid);
  const zBelow = plan.zTop - CAP_OVERLAP_MM;
  const below = scope.register(
    box(b.xMax - b.xMin + 2, b.yMax - b.yMin + 2, zBelow - b.zMin + 1, {
      at: [(b.xMin + b.xMax) / 2, (b.yMin + b.yMax) / 2, (b.zMin - 1 + zBelow) / 2],
    })
  );
  try {
    return scope.register(unwrap(cut(ramps.solid as ValidSolid, below)));
  } catch {
    return null;
  }
}

/**
 * The rectangle's air as a primitive box, its arc corners rounded by a first
 * fillet. On the same outline drawn and extruded, OCCT rejects the fillet up a
 * lipless ramp at every radius the retry tries.
 */
function boxAir(
  plan: CompartmentFilletPlan,
  zCut: number,
  keepsArc: readonly boolean[]
): Shape3D | null {
  const xs = plan.floor.map((v) => v.x);
  const ys = plan.floor.map((v) => v.y);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const solid = box(maxX - minX, maxY - minY, zCut - plan.zFloor, {
    at: [(minX + maxX) / 2, (minY + maxY) / 2, (plan.zFloor + zCut) / 2],
  });
  const arcs = (getEdges(solid) as Edge[]).filter((edge) => {
    const b = getBounds(edge);
    if (b.zMax - b.zMin < EDGE_TOL_MM) return false;
    return plan.floor.some(
      (v, i) => keepsArc[i] && Math.abs(v.x - b.xMin) < 1e-6 && Math.abs(v.y - b.yMin) < 1e-6
    );
  });
  if (arcs.length === 0) return solid;
  const rounded = fillet(solid, arcs, plan.cornerRadius);
  solid.delete();
  return isOk(rounded) ? unwrap(rounded) : null;
}

/** Which walls each vertex of an axis-aligned rectangle sits on. */
function rectangleSides(loop: readonly FilletPt[]): ScoopSide[][] {
  const xs = loop.map((v) => v.x);
  const ys = loop.map((v) => v.y);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;
  return loop.map((v) => {
    const sides: ScoopSide[] = [];
    if (near(v.y, minY)) sides.push('front');
    if (near(v.y, maxY)) sides.push('back');
    if (near(v.x, minX)) sides.push('left');
    if (near(v.x, maxX)) sides.push('right');
    return sides;
  });
}

/** The smallest angle between two faces' normals an edge must turn through to be rounded. */
const MIN_JUNCTION_DEG = 20;

/**
 * The air's edges the fillet rounds: every convex junction below the top of
 * its reach that meets the floor, or climbs a wall (a vertical plane). That
 * keeps the chain up each ramp's side and the corners above it, and leaves out
 * the ramp's own tangent foot and the valley where two ramps meet, neither of
 * which a rolling ball of this radius can follow to its end.
 */
function junctionEdges(air: Shape3D, zFloor: number, zTop: number): Edge[] {
  const picked: Edge[] = [];
  for (const edge of getEdges(air) as Edge[]) {
    if (getBounds(edge).zMin > zTop - EDGE_TOL_MM) continue;
    const faces = facesOfEdge(air, edge);
    if (faces.length !== 2) continue;
    const [a, b] = faces;
    const m = curvePointAt(edge, 0.5);
    const na = normalAt(a, m);
    const nb = normalAt(b, m);
    const cos = na[0] * nb[0] + na[1] * nb[1] + na[2] * nb[2];
    if (Math.acos(Math.max(-1, Math.min(1, cos))) < (MIN_JUNCTION_DEG * Math.PI) / 180) continue;
    const isWall = (f: Face, n: readonly number[]): boolean =>
      faceGeomType(f) === 'PLANE' && Math.abs(n[2]) < 1e-3;
    const isFloor = (f: Face, n: readonly number[]): boolean =>
      faceGeomType(f) === 'PLANE' &&
      Math.abs(Math.abs(n[2]) - 1) < 1e-3 &&
      Math.abs(getBounds(f).zMin - zFloor) < EDGE_TOL_MM;
    const onFloor = isFloor(a, na) || isFloor(b, nb);
    const onWall = isWall(a, na) || isWall(b, nb);
    // Horizontal along a wall is where a ramp's top facet crosses into it, at
    // whatever shallow angle its first chord makes; a rolling ball there would
    // span the whole scooped wall. The ramp's sides and the corners are sloped.
    const b0 = getBounds(edge);
    const horizontal = b0.zMax - b0.zMin < EDGE_TOL_MM;
    if (!onFloor && !(onWall && !horizontal)) continue;
    if (isConvex(edge, na, b, nb, m)) picked.push(edge);
  }
  return picked;
}

/** Whether face `b` falls away behind face `a`'s plane: a convex edge of the solid. */
function isConvex(
  edge: Edge,
  na: readonly number[],
  b: Face,
  nb: readonly number[],
  m: readonly number[]
): boolean {
  const t = curveTangentAt(edge, 0.5);
  let d = [t[1] * nb[2] - t[2] * nb[1], t[2] * nb[0] - t[0] * nb[2], t[0] * nb[1] - t[1] * nb[0]];
  const len = Math.hypot(d[0], d[1], d[2]);
  if (len < 1e-9) return false;
  d = d.map((v) => v / len);
  const step = 0.05;
  const probe: [number, number, number] = [
    m[0] + d[0] * step,
    m[1] + d[1] * step,
    m[2] + d[2] * step,
  ];
  if (classifyPointOnFace(b, probe) !== 'in') d = d.map((v) => -v);
  return d[0] * na[0] + d[1] * na[1] + d[2] * na[2] < 0;
}
