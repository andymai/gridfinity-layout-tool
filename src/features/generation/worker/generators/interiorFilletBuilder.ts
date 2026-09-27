/**
 * Interior fillet: rounds each compartment's wall-to-floor edges and its
 * vertical corners.
 *
 * Built additively, compartment by compartment. The compartment's air is drawn
 * sharp from its plan and filleted by OCCT; the air grown a little into the
 * walls, dividers and floor, minus that filleted air, is exactly the rounding
 * plus a skin buried in material that makes the fuse overlap rather than meet
 * face to face. Everything the fillet must not add to (a doorway cut into a
 * wall, the air above a short divider) is kept out of the grown air or cut from
 * the result, because this solid only ever adds material.
 */

import {
  clone,
  cut,
  cutAll,
  draw,
  fillet,
  fuseAll,
  getBounds,
  getEdges,
  intersect,
  isOk,
  unwrap,
  withScope,
} from 'brepjs';
import type { DisposalScope, Drawing, Edge, Shape3D, Sketch, ValidSolid } from 'brepjs';
import { isNestingBase } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import { interiorFilletRadiusMm } from '@/shared/utils/interiorFillet';
import type { BinParams } from '@/shared/types/bin';
import { COPLANAR_MARGIN } from './generatorConstants';
import { planInteriorFillets } from './interiorFilletPlan';
import type { CompartmentFilletPlan, FilletPt, FilletVertex } from './interiorFilletPlan';
import { resolveFloorRaises } from './floorRaiseBuilder';
import { buildMaskHoleDrawings, maskHasHoles } from './maskPolygon';
import { buildTaperedInnerEnvelope } from './taperedOuter';
import type { ResolvedTaper } from './overhang';
import { buildWallCutoutCuts, interiorDividerTopZ } from './wallCutoutBuilder';
import { resolveCompartmentDividerHeight } from '@/shared/utils/slotMath';
import type { BinDimensions } from './pipeline/types';

/** How far the cutter's top clears the grown air's, so no two faces coincide. */
const CUTTER_OVERSHOOT_MM = 1;

/** Factors the fillet is retried at when OCCT rejects the full radius. */
const RETRY_FACTORS = [1, 0.8, 0.6] as const;

/** An edge within this of the floor plane is a floor edge. */
const EDGE_TOL_MM = 1e-3;

const MIN_ARC_MM = 0.05;

export interface InteriorFilletBuild {
  readonly params: BinParams;
  readonly dimensions: BinDimensions;
  readonly radius: number;
}

/** Each compartment's clamped fillet, in the cavity frame. */
export function planBinInteriorFillets(input: InteriorFilletBuild): CompartmentFilletPlan[] {
  const { params, dimensions: dim } = input;
  // Floor raises are not built on a custom shape, so its fillet stays on the
  // shell's floor whatever raises the design still carries.
  const raises = isPartialMask(params.cellMask)
    ? new Map<number, number>()
    : resolveFloorRaises(params, dim.floorThickness, dim.interiorHeight);
  return planInteriorFillets({
    params,
    innerW: dim.innerW,
    innerD: dim.innerD,
    // The custom-shape hollow never gets the spec floor slab `buildBinBox`
    // fuses onto every other body, so its cavity floor is still the shell's.
    floorZ: isPartialMask(params.cellMask) ? params.wallThickness : dim.floorThickness,
    interiorHeight: dim.interiorHeight,
    dividerHeight: dim.compartmentsBakedIntoShell
      ? dim.wallHeight
      : resolveCompartmentDividerHeight(params.compartments.dividerHeight, dim.interiorHeight),
    bakedCavities: dim.compartmentsBakedIntoShell,
    floorRaise: (id) => raises.get(id) ?? 0,
    radius: input.radius,
    pitch: { x: dim.gridUnitMmX, y: dim.gridUnitMmY },
  });
}

/**
 * The floor each fillet covers, as boxes along every side and a box around
 * every rounded corner (whose radius can be wider than the floor fillet's): a
 * floor pattern hole reaching into one would leave a half-hole in the curve.
 */
export function interiorFilletFloorFootprints(
  input: InteriorFilletBuild
): { xMin: number; xMax: number; yMin: number; yMax: number }[] {
  const out: { xMin: number; xMax: number; yMin: number; yMax: number }[] = [];
  for (const plan of planBinInteriorFillets(input)) {
    for (const loop of [plan.floor, ...plan.holes.map((h) => h.floor)]) {
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i];
        const b = loop[(i + 1) % loop.length];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const nx = (-(b.y - a.y) / len) * plan.radius;
        const ny = ((b.x - a.x) / len) * plan.radius;
        const xs = [a.x, b.x, a.x + nx, b.x + nx];
        const ys = [a.y, b.y, a.y + ny, b.y + ny];
        out.push({
          xMin: Math.min(...xs),
          xMax: Math.max(...xs),
          yMin: Math.min(...ys),
          yMax: Math.max(...ys),
        });
        if (a.convex) {
          const c = plan.cornerRadius;
          out.push({ xMin: a.x - c, xMax: a.x + c, yMin: a.y - c, yMax: a.y + c });
        }
      }
    }
  }
  return out;
}

/** The fillet solid for every compartment, fused, or null when none was built. */
export function buildInteriorFillet(input: InteriorFilletBuild): Shape3D | null {
  const { params, dimensions: dim } = input;
  const plans = planBinInteriorFillets(input);
  if (plans.length === 0) return null;

  return withScope((scope: DisposalScope): Shape3D | null => {
    const pen = Math.min(
      COPLANAR_MARGIN,
      params.wallThickness * 0.6,
      params.compartments.thickness * 0.4
    );
    const pieces: Shape3D[] = [];
    for (const plan of plans) {
      const piece = buildCompartmentFillet(scope, plan, pen);
      if (piece) pieces.push(piece);
    }
    if (pieces.length === 0) return null;
    const fused =
      pieces.length === 1 ? pieces[0] : scope.register(unwrap(fuseAll(pieces as ValidSolid[])));
    // Each trim keeps the fillet out of somewhere it must not reach, so a
    // fillet one of them fails on is left out rather than built through it.
    const tapered = clipToTaper(scope, fused, params, dim, pen);
    const holed = tapered && clearMaskHoles(scope, tapered, params, dim);
    const trimmed = holed && trimDoorways(scope, holed, params, dim, plans);
    return trimmed ? unwrap(clone(trimmed)) : null;
  });
}

function buildCompartmentFillet(
  scope: DisposalScope,
  plan: CompartmentFilletPlan,
  pen: number
): Shape3D | null {
  const zCut = plan.zTop + CUTTER_OVERSHOOT_MM;
  const air = scope.register(
    prismBetween(scope, plan, plan.zFloor, zCut, 0, airCorner(plan.cornerRadius))
  );
  const rounded = filletAir(scope, air, plan);
  if (!rounded) return null;
  const floorPen = Math.min(COPLANAR_MARGIN, plan.zFloor * 0.5);
  const grown = scope.register(
    prismBetween(scope, plan, plan.zFloor - floorPen, plan.zTop, pen, grownCorner(pen))
  );
  try {
    return scope.register(unwrap(cut(grown as ValidSolid, rounded as ValidSolid)));
  } catch {
    return null;
  }
}

/** The air's outline: convex corners at `convexRadius`, reflex ones as the body drew them. */
function airCorner(convexRadius: number): (v: FilletVertex) => number {
  return (v) => (v.convex ? convexRadius : v.bodyRadius);
}

/** The grown air stays concentric with every arc the body already has. */
function grownCorner(pen: number): (v: FilletVertex) => number {
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

function leans(floor: readonly FilletVertex[], top: readonly FilletVertex[]): boolean {
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
function prismBetween(
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

/**
 * Round the air's floor edges at the plan's radius, which blends round each
 * corner arc as a torus.
 *
 * The corner radius is drawn into the outline rather than filleted alongside:
 * occt-wasm takes one radius per fillet call, whatever the callback says.
 */
function filletAir(
  scope: DisposalScope,
  air: Shape3D,
  plan: CompartmentFilletPlan
): Shape3D | null {
  const edges = (getEdges(air) as Edge[]).filter((edge) => {
    const b = getBounds(edge);
    return b.zMax - b.zMin < EDGE_TOL_MM && Math.abs(b.zMin - plan.zFloor) < EDGE_TOL_MM;
  });
  if (edges.length === 0) return null;
  for (const factor of RETRY_FACTORS) {
    try {
      const result = fillet(air as ValidSolid, edges, plan.radius * factor);
      if (isOk(result)) return scope.register(unwrap(result));
    } catch {
      // next factor
    }
  }
  return null;
}

/**
 * A bottom-band taper leans the outer wall in toward the floor, so the grown air
 * drawn on the rim-level wall line would push out through it. Trim to the
 * tapered cavity grown by the same skin, as the scoop does, or null when the
 * trim fails.
 */
function clipToTaper(
  scope: DisposalScope,
  solid: Shape3D,
  params: BinParams,
  dim: BinDimensions,
  pen: number
): Shape3D | null {
  const taper: ResolvedTaper | null = dim.overhang.taper;
  if (!taper) return solid;
  try {
    const envelope = scope.register(
      buildTaperedInnerEnvelope(
        dim.innerW + 2 * params.wallThickness,
        dim.innerD + 2 * params.wallThickness,
        dim.wallHeight,
        params.wallThickness,
        taper,
        dim.wallHeight + 2,
        0,
        0,
        pen
      )
    );
    return scope.register(unwrap(intersect(solid as ValidSolid, envelope as ValidSolid)));
  } catch {
    return null;
  }
}

/**
 * The traced outline is a custom shape's outer loop alone, so the grown air
 * spans any hole through the bin, and its floor skin would close the hole with a
 * membrane. Cut the holes back out, at the clearance the shell cuts them with,
 * or null when a cut fails.
 */
function clearMaskHoles(
  scope: DisposalScope,
  solid: Shape3D,
  params: BinParams,
  dim: BinDimensions
): Shape3D | null {
  const mask = params.cellMask;
  if (!mask || !isPartialMask(mask) || !maskHasHoles(mask)) return solid;
  let result = solid;
  for (const hole of buildMaskHoleDrawings(mask, { x: dim.gridUnitMmX, y: dim.gridUnitMmY })) {
    const tool = scope.register(hole.sketchOnPlane('XY', -1).extrude(dim.wallHeight + 2));
    try {
      result = scope.register(unwrap(cut(result as ValidSolid, tool as ValidSolid)));
    } catch {
      return null;
    }
  }
  return result;
}

/**
 * Wall cutouts are cut after every fuse, through the wall and only a little
 * past it. A fillet standing in the doorway would survive that as a curb, so
 * the same profiles, reaching past the widest rounding, are cut here first, or
 * null when the cut fails.
 */
function trimDoorways(
  scope: DisposalScope,
  solid: Shape3D,
  params: BinParams,
  dim: BinDimensions,
  plans: readonly CompartmentFilletPlan[]
): Shape3D | null {
  if (!params.walls.enabled) return solid;
  const reach = Math.max(...plans.map((p) => p.cornerRadius)) + COPLANAR_MARGIN;
  try {
    const tools = buildWallCutoutCuts(
      params,
      dim.innerW,
      dim.innerD,
      dim.wallHeight,
      dim.hasLip,
      interiorDividerTopZ(params, dim),
      reach
    );
    if (!tools) return solid;
    scope.register(tools);
    return scope.register(unwrap(cut(solid as ValidSolid, tools as ValidSolid)));
  } catch {
    return null;
  }
}

// --- FeatureBuilder protocol ---

import type { FeatureBuilder } from './pipeline/featureBuilder';
import { FeatureTag } from './featureTags';
import { buildCacheKey, compactKey, quantize, stableSerialize } from './cacheKeyUtils';

/**
 * Same floor-dependence as the scoop: a slotted bin's grooves and a floor
 * opened by lite or a spacer have no junction to round.
 */
export function interiorFilletApplies(params: BinParams, dim: BinDimensions): boolean {
  return (
    interiorFilletRadiusMm(params) > 0 &&
    params.style === 'standard' &&
    !isNestingBase(params.base) &&
    !dim.liteFloorOpen
  );
}

export const interiorFilletFeature: FeatureBuilder = {
  name: 'interiorFillet',
  tag: FeatureTag.BASE,
  target: 'fuse',
  supportsCellMask: true,
  shouldBuild: (ctx) => interiorFilletApplies(ctx.params, ctx.dimensions),
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
    return compactKey(
      buildCacheKey(
        'v1',
        dim.shellKey,
        quantize(interiorFilletRadiusMm(params)),
        quantize(dim.innerW),
        quantize(dim.innerD),
        quantize(dim.wallHeight),
        quantize(dim.interiorHeight),
        quantize(dim.floorThickness),
        quantize(params.wallThickness),
        quantize(params.compartments.thickness),
        dim.hasLip,
        dim.compartmentsBakedIntoShell,
        params.compartments.cols,
        params.compartments.rows,
        params.compartments.cells.join(','),
        stableSerialize(params.compartments.dividerOverrides ?? []),
        stableSerialize(params.compartments.dividerHeight ?? 'auto'),
        stableSerialize(params.compartments.floorRaises ?? []),
        stableSerialize(params.walls)
      )
    );
  },
  build: (ctx) => {
    const radius = interiorFilletRadiusMm(ctx.params);
    if (radius === 0) return null;
    const result = buildInteriorFillet({
      params: ctx.params,
      dimensions: ctx.dimensions,
      radius,
    });
    return result ? [result] : null;
  },
};
