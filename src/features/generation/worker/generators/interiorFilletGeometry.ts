/** Outline and cutter geometry shared by the interior fillet's builders. */

import { cut, cutAll, draw, fillet, isOk, unwrap } from 'brepjs';
import type { DisposalScope, Drawing, Edge, Shape3D, Sketch, ValidSolid } from 'brepjs';
import { COPLANAR_MARGIN } from './generatorConstants';
import type { CompartmentFilletPlan, FilletPt, FilletVertex } from './interiorFilletPlan';

/** How far the cutter's top clears the grown air's, so no two faces coincide. */
export const CUTTER_OVERSHOOT_MM = 1;

/** An edge within this of a plane counts as on it. */
export const EDGE_TOL_MM = 1e-3;

/** Factors the fillet is retried at when OCCT rejects the full radius. */
const RETRY_FACTORS = [1, 0.8, 0.6] as const;

const MIN_ARC_MM = 0.05;

/** The rounded air, or null when OCCT rejects every radius tried. */
export function filletWithRetry(
  scope: DisposalScope,
  air: Shape3D,
  edges: Edge[],
  radius: number
): Shape3D | null {
  for (const factor of RETRY_FACTORS) {
    try {
      const result = fillet(air as ValidSolid, edges, radius * factor);
      if (isOk(result)) return scope.register(unwrap(result));
    } catch {
      // next factor
    }
  }
  return null;
}

/**
 * The air grown into the material around it, minus the rounded air: the
 * rounding itself, plus a skin buried where it fuses.
 */
export function roundingMaterial(
  scope: DisposalScope,
  plan: CompartmentFilletPlan,
  pen: number,
  rounded: Shape3D,
  zTop: number = plan.zTop
): Shape3D {
  const floorPen = Math.min(COPLANAR_MARGIN, plan.zFloor * 0.5);
  const grown = scope.register(
    prismBetween(scope, plan, plan.zFloor - floorPen, zTop, pen, grownCorner(pen))
  );
  return scope.register(unwrap(cut(grown as ValidSolid, rounded as ValidSolid)));
}

/** The air's outline: convex corners at `convexRadius`, reflex ones as the body drew them. */
export function airCorner(convexRadius: number): (v: FilletVertex) => number {
  return (v) => (v.convex ? convexRadius : v.bodyRadius);
}

/** The grown air stays concentric with every arc the body already has. */
export function grownCorner(pen: number): (v: FilletVertex) => number {
  return (v) => {
    if (v.bodyRadius <= 0) return 0;
    return v.convex ? v.bodyRadius + pen : Math.max(v.bodyRadius - pen, 0);
  };
}

/** A loop's vertices at height `z`, which move linearly between floor and top. */
function loopAt(
  plan: CompartmentFilletPlan,
  floor: readonly FilletVertex[],
  top: readonly FilletVertex[],
  z: number
): FilletVertex[] {
  const span = plan.zTop - plan.zFloor;
  const t = span > 0 ? (z - plan.zFloor) / span : 0;
  return floor.map((f, i) => ({
    ...f,
    x: f.x + (top[i].x - f.x) * t,
    y: f.y + (top[i].y - f.y) * t,
  }));
}

export function leans(floor: readonly FilletVertex[], top: readonly FilletVertex[]): boolean {
  return floor.some((f, i) => Math.abs(f.x - top[i].x) > 1e-9 || Math.abs(f.y - top[i].y) > 1e-9);
}

function loopPrism(
  plan: CompartmentFilletPlan,
  floor: readonly FilletVertex[],
  top: readonly FilletVertex[],
  z0: number,
  z1: number,
  grow: number,
  corner: (v: FilletVertex) => number
): Shape3D {
  const drawingAt = (z: number): Drawing => {
    const loop = loopAt(plan, floor, top, z);
    return loopDrawing(grow > 0 ? offsetLoop(loop, grow) : loop, loop.map(corner));
  };
  if (!leans(floor, top))
    return drawingAt(z0)
      .sketchOnPlane('XY', z0)
      .extrude(z1 - z0);
  const bottom = drawingAt(z0).sketchOnPlane('XY', z0) as Sketch;
  const upper = drawingAt(z1).sketchOnPlane('XY', z1) as Sketch;
  return bottom.loftWith([upper], { ruled: true });
}

/**
 * The plan's outline as a prism between two heights, its holes cut through. A
 * hole runs clockwise, so the offset that grows the outline shrinks a hole,
 * pushing the skin into the dividers round it the same way.
 */
export function prismBetween(
  scope: DisposalScope,
  plan: CompartmentFilletPlan,
  z0: number,
  z1: number,
  grow: number,
  corner: (v: FilletVertex) => number
): Shape3D {
  const solid = loopPrism(plan, plan.floor, plan.top, z0, z1, grow, corner);
  if (plan.holes.length === 0) return solid;
  scope.register(solid);
  const cutters = plan.holes.map((h) =>
    scope.register(
      loopPrism(plan, h.floor, h.top, z0 - COPLANAR_MARGIN, z1 + COPLANAR_MARGIN, grow, corner)
    )
  );
  return unwrap(cutAll(solid as ValidSolid, cutters as ValidSolid[]));
}

/** Each side pushed `d` to its right, which is outward for a CCW loop. */
function offsetLoop(loop: readonly FilletVertex[], d: number): FilletVertex[] {
  const n = loop.length;
  const shifted = loop.map((a, i) => {
    const b = loop[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = (b.y - a.y) / len;
    const ny = -(b.x - a.x) / len;
    return {
      p: { x: a.x + nx * d, y: a.y + ny * d },
      dir: { x: (b.x - a.x) / len, y: (b.y - a.y) / len },
    };
  });
  return loop.map((v, i) => {
    const prev = shifted[(i - 1 + n) % n];
    const next = shifted[i];
    const hit = intersect2d(prev.p, prev.dir, next.p, next.dir);
    return { ...v, ...(hit ?? { x: next.p.x, y: next.p.y }) };
  });
}

function intersect2d(p: FilletPt, d: FilletPt, q: FilletPt, e: FilletPt): FilletPt | null {
  const den = d.x * e.y - d.y * e.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((q.x - p.x) * e.y - (q.y - p.y) * e.x) / den;
  return { x: p.x + t * d.x, y: p.y + t * d.y };
}

/** A closed outline with a tangent arc of `radii[i]` at each vertex that has one. */
function loopDrawing(loop: readonly FilletPt[], radii: readonly number[]): Drawing {
  const n = loop.length;
  const tangents = loop.map((v, i) => {
    const r = radii[i];
    if (r < MIN_ARC_MM) return null;
    const prev = loop[(i - 1 + n) % n];
    const next = loop[(i + 1) % n];
    const inLen = Math.hypot(v.x - prev.x, v.y - prev.y);
    const outLen = Math.hypot(next.x - v.x, next.y - v.y);
    const din = { x: (v.x - prev.x) / inLen, y: (v.y - prev.y) / inLen };
    const dout = { x: (next.x - v.x) / outLen, y: (next.y - v.y) / outLen };
    const turn = Math.acos(Math.max(-1, Math.min(1, din.x * dout.x + din.y * dout.y)));
    const reach = r * Math.tan(turn / 2);
    return {
      from: [v.x - din.x * reach, v.y - din.y * reach] as [number, number],
      to: [v.x + dout.x * reach, v.y + dout.y * reach] as [number, number],
    };
  });
  const last = tangents[n - 1];
  let pen = draw(last ? last.to : [loop[n - 1].x, loop[n - 1].y]);
  for (let i = 0; i < n - 1; i++) {
    const t = tangents[i];
    pen = t ? pen.lineTo(t.from).tangentArcTo(t.to) : pen.lineTo([loop[i].x, loop[i].y]);
  }
  if (last) pen = pen.lineTo(last.from).tangentArcTo(last.to);
  return pen.close();
}
