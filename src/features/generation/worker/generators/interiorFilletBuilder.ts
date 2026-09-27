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
 *
 * Compartments with finger scoops are rounded in `interiorFilletScoop.ts`.
 */

import { cut, fuseAll, getBounds, getEdges, intersect, translate, unwrap, withScope } from 'brepjs';
import type { DisposalScope, Edge, Shape3D, ValidSolid } from 'brepjs';
import { isNestingBase } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import { interiorFilletRadiusMm } from '@/shared/utils/interiorFillet';
import type { BinParams } from '@/shared/types/bin';
import { COPLANAR_MARGIN } from './generatorConstants';
import { planInteriorFillets } from './interiorFilletPlan';
import type { CompartmentFilletPlan } from './interiorFilletPlan';
import {
  CUTTER_OVERSHOOT_MM,
  EDGE_TOL_MM,
  airCorner,
  filletWithRetry,
  prismBetween,
  roundingMaterial,
} from './interiorFilletGeometry';
import { buildScoopedCompartmentFillet, climbedRamps, rampCap } from './interiorFilletScoop';
import type { CompartmentRamps } from './interiorFilletScoop';
import { filletClimbsRamps, fuseScoopRamps, scoopRampsApply } from './scoopRampBuilder';
import { resolveFloorRaises } from './floorRaiseBuilder';
import { buildMaskHoleDrawings, maskHasHoles } from './maskPolygon';
import { buildTaperedInnerEnvelope } from './taperedOuter';
import type { ResolvedTaper } from './overhang';
import { buildWallCutoutCuts, interiorDividerTopZ } from './wallCutoutBuilder';
import { resolveCompartmentDividerHeight } from '@/shared/utils/slotMath';
import type { BinDimensions } from './pipeline/types';

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

/**
 * The fillet solid for every compartment, fused with the scoop ramps it climbs,
 * or null when there is neither.
 */
export function buildInteriorFillet(input: InteriorFilletBuild): Shape3D | null {
  const { params, dimensions: dim } = input;
  const plans = planBinInteriorFillets(input);
  const withScoops = scoopRampsApply(params, dim);
  if (plans.length === 0 && !withScoops) return null;

  return withScope((scope: DisposalScope): Shape3D | null => {
    const pen = Math.min(
      COPLANAR_MARGIN,
      params.wallThickness * 0.6,
      params.compartments.thickness * 0.4
    );
    const raises = resolveFloorRaises(params, dim.floorThickness, dim.interiorHeight);
    const climbed =
      withScoops && filletClimbsRamps(params)
        ? climbedRamps(scope, input, raises)
        : new Map<number, CompartmentRamps>();
    const owned = [...climbed.values()].map((r) => r.solid);
    const pieces: Shape3D[] = [];
    // Ramps this feature took over but does not round, built as the scoop
    // feature would have.
    const asBuilt: Shape3D[] = [];
    for (const plan of plans) {
      const ramps = climbed.get(plan.id);
      climbed.delete(plan.id);
      const rounded = ramps
        ? buildScoopedCompartmentFillet(scope, plan, pen, ramps, dim.wallHeight)
        : null;
      if (ramps && rounded) {
        pieces.push(rounded);
        if (ramps.top > plan.zTop) asBuilt.push(rampCap(scope, plan, ramps) ?? ramps.solid);
        continue;
      }
      if (ramps) asBuilt.push(ramps.solid);
      const plain = buildCompartmentFillet(scope, plan, pen);
      if (plain) pieces.push(plain);
    }
    for (const ramps of climbed.values()) asBuilt.push(ramps.solid);
    const ramps = fuseScoopRamps(
      scope,
      params,
      asBuilt,
      dim.innerW,
      dim.innerD,
      dim.wallHeight,
      params.wallThickness,
      dim.overhang.taper
    );
    if (ramps) pieces.push(ramps);
    if (pieces.length === 0) return null;
    const fused =
      pieces.length === 1 ? pieces[0] : scope.register(unwrap(fuseAll(pieces as ValidSolid[])));
    // Each trim keeps the fillet out of somewhere it must not reach, so a
    // fillet one of them fails on is left out rather than built through it,
    // keeping only the ramps it took over from the scoop feature.
    const tapered = clipToTaper(scope, fused, params, dim, pen);
    const holed = tapered && clearMaskHoles(scope, tapered, params, dim);
    const trimmed =
      (holed && trimDoorways(scope, holed, params, dim, plans)) ??
      fuseScoopRamps(
        scope,
        params,
        owned,
        dim.innerW,
        dim.innerD,
        dim.wallHeight,
        params.wallThickness,
        dim.overhang.taper
      );
    // `translate`, not `clone`: it carries the ramps' scoop tags.
    return trimmed ? translate(trimmed, [0, 0, 0]) : null;
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
  try {
    return roundingMaterial(scope, plan, pen, rounded);
  } catch {
    return null;
  }
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
  return filletWithRetry(scope, air, edges, plan.radius);
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
  if (!params.walls.enabled || plans.length === 0) return solid;
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
  tagsOwnFaces: true,
  shouldBuild: (ctx) => interiorFilletApplies(ctx.params, ctx.dimensions),
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
    return compactKey(
      buildCacheKey(
        'v2',
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
        stableSerialize(params.walls),
        // The fillet builds the scoop ramps it climbs.
        stableSerialize(params.scoop),
        params.style
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
