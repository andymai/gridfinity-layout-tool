/**
 * Finger scoop ramp builder for Gridfinity bins.
 *
 * Generates concave quarter-cylinder ramps at the chosen edge of each compartment
 * to help slide items out of the bin.
 */

import { interiorFilletRadiusMm } from '@/shared/utils/interiorFillet';
import {
  draw,
  drawRoundedRectangle,
  translate,
  rotate,
  withScope,
  clone,
  unwrap,
  fuseAll,
  intersect,
} from 'brepjs';
import type { Shape3D, ValidSolid, DisposalScope } from 'brepjs';
import type { BinParams, ScoopSide } from '@/shared/types/bin';
import { sketch } from './meshUtils';
import { resolveScoopSides } from '@/shared/utils/scoopCalculations';
import { BOX_CORNER_RADIUS, COPLANAR_MARGIN } from './generatorConstants';
import { resolveFloorRaises } from './floorRaisePlan';
import { planScoopRamps, scoopRampsApply } from './scoopRampPlan';
import { buildTaperedInnerEnvelope } from './taperedOuter';
import type { ResolvedTaper } from './overhang';
/**
 * Build finger scoop ramps that curve from the bin floor up to `scoop.side`.
 *
 * Each scoop is a solid ramp with a concave quarter-cylinder inner surface,
 * fused into the bin interior at the chosen edge of each compartment. The
 * ramp fills the wall-floor junction and the concave curve helps slide
 * items out of the bin.
 *
 * Scoops are placed on the same wall of every compartment. For merged
 * compartments a single scoop spans the full merged extent along that wall.
 *
 * When the bin has a stacking lip and the compartment touches the outer wall
 * on that side, the scoop is offset inward by the lip overhang so its top edge
 * meets the lip's protruding inner face, providing a smooth exit path.
 *
 * @param params - Bin parameters (scoop config, compartments)
 * @param innerW - Interior width in mm (outer - 2 x wallThickness)
 * @param innerD - Interior depth in mm
 * @param wallHeight - Full wall height in mm (box body Z extent)
 * @param wallThickness - Outer wall thickness in mm
 * @param floorZ - Interior floor top in mm above the box bottom; the ramps stand on it
 * @returns Fused ramp shape, or null if no scoops were built
 */
export function buildScoopRamps(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number,
  floorZ: number,
  floorRaiseFor: (compartmentId: number) => number = () => 0,
  taper: ResolvedTaper | null = null
): Shape3D | null {
  if (!params.scoop.enabled) return null;
  if (params.style !== 'standard') return null;

  return withScope((scope: DisposalScope): Shape3D | null => {
    const fused = buildScoopRampsInScope(
      scope,
      params,
      innerW,
      innerD,
      wallHeight,
      wallThickness,
      floorZ,
      floorRaiseFor,
      taper
    );
    // Clone so scope can dispose the fused original on exit.
    return fused ? unwrap(clone(fused)) : null;
  });
}

/** Control-point reach, as a fraction of each radius, of the cubic Bézier nearest a quarter ellipse. */
const QUARTER_ELLIPSE_K = (4 / 3) * (Math.SQRT2 - 1);

export interface ScoopRampSolid {
  readonly compId: number;
  readonly side: ScoopSide;
  /** Positioned in the cavity frame, reaching into the walls around it and unclipped. */
  readonly solid: Shape3D;
  /**
   * Built into the interior fillet's own solid, which rounds up its sides,
   * instead of by the scoop feature.
   */
  readonly climbed: boolean;
}

/** Whether the interior fillet climbs this bin's ramps, building them itself. */
export function filletClimbsRamps(params: BinParams): boolean {
  const sides = resolveScoopSides(params.scoop);
  // Ramps on adjacent walls cross in the corner between them, down to where
  // both arcs lie tangent to the floor. Drawn smooth, `fuseAll` hands the pair
  // back overlapping with their shared volume counted twice; chords cross
  // cleanly.
  const crossing =
    sides.some((s) => s === 'front' || s === 'back') &&
    sides.some((s) => s === 'left' || s === 'right');
  // A wall cutout trims the fillet around its doorway, which would notch a ramp
  // carried inside it.
  return interiorFilletRadiusMm(params) > 0 && !crossing && !params.walls.enabled;
}

/**
 * How far a ramp's back and ends are pushed into the walls and dividers around
 * it: below the outer wall thickness (never breach it) and below 0.4x the
 * divider thickness, so two neighbouring compartments penetrating a shared
 * divider from opposite sides cannot meet through it.
 */
export function scoopWallPenetration(params: BinParams, wallThickness: number): number {
  return Math.min(COPLANAR_MARGIN, wallThickness * 0.6, params.compartments.thickness * 0.4);
}

export function buildScoopRampSolids(
  scope: DisposalScope,
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number,
  floorZ: number,
  floorRaiseFor: (compartmentId: number) => number,
  taper: ResolvedTaper | null
): ScoopRampSolid[] {
  // The ramp's back edge and its two span ends sit on the surrounding walls'
  // inner faces. Merely TOUCHING those faces leaves zero-thickness coincident
  // faces when the ramp is fused into the body — non-manifold membranes (they
  // surface as degenerate slivers where the ramp arc meets a side wall). Push
  // the contact faces INTO the surrounding material so the fuse overlaps
  // instead, following the COPLANAR_MARGIN pattern used throughout the
  // pipeline.
  const wallPenetration = scoopWallPenetration(params, wallThickness);

  const climbs = filletClimbsRamps(params);
  const ramps: ScoopRampSolid[] = [];
  for (const plan of planScoopRamps(
    params,
    innerW,
    innerD,
    wallHeight,
    wallThickness,
    floorZ,
    floorRaiseFor,
    taper
  )) {
    const { compId, side, placement, lipOffset, height, style, arcTop, floorStart, run, wallAt } =
      plan;
    const { span } = placement;
    const compFloorZ = plan.floorZ;
    const wallAtTop = wallAt(height);

    // Build scoop ramp solid.
    // Profile in YZ plane: draw([u, v]) where u->Y (depth), v->Z (height).
    // The ramp descends from (arcTop, height) to (floorStart + run, 0):
    // a concave quarter-ellipse ('curved') or a straight bevel ('straight').
    // Without lip offset (lipOffset = 0):
    //   (0, 0) -> (0, H) -> ramp -> (run, 0) -> close
    // With lip offset (lo), extends to wallHeight so scoop meets lip:
    //   (0, 0) -> (0, wH) -> (lo, wH) -> (lo, H) -> ramp -> (lo+run, 0) -> close
    //   Goes up the wall to wallHeight, across to the lip's inner face,
    //   down to ramp start at H, then descends to floor. Fills solid.
    // Against a tapered wall the arc top moves in to `arcTop` along a ledge
    // at H that lies inside the wall.
    // The wall-hugging back edge is authored at `-wallPenetration` (inside the
    // wall) rather than 0 (on its inner face) so the fuse overlaps material;
    // see `wallPenetration` above. The visible ramp surface (arc + top edge at
    // Y=arcTop) is unchanged.
    const backY = -wallPenetration;
    // The ramp's underside is buried into the floor the same way its back is
    // buried into the wall: landing it exactly on the floor top leaves a
    // coplanar face for the fuse. Never deeper than half the floor.
    const floorPenetration = Math.min(COPLANAR_MARGIN, compFloorZ * 0.5);
    const segments = 24;
    const points: [number, number][] = [];
    // Start below the wall/floor corner, inside the floor
    points.push([backY, -floorPenetration]);
    if (lipOffset > 0) {
      // Up the wall to wallHeight (lip base), across to lip inner face
      points.push([backY, plan.wallHeight]);
      points.push([lipOffset, plan.wallHeight]);
      // Down to ramp start (only needed when height < wallHeight)
      if (height < plan.wallHeight) {
        points.push([lipOffset, height]);
      }
    } else {
      // Standard: up the wall to scoop height
      points.push([backY, height]);
    }
    // A curved ramp the interior fillet climbs is one smooth quarter-ellipse
    // rather than chords, since the fillet rolls along it: over the chords'
    // kinks OCCT builds a body whose volume integral disagrees with its own
    // mesh. A leaning wall warps the arc point by point, so it keeps the
    // chords, and the fillet leaves that ramp alone.
    const leans = wallAt(0) !== wallAtTop;
    const smoothArc = climbs && style === 'curved' && !leans;
    // A smooth arc leaves the wall face itself, tangent to it, where the
    // chords start from inside the wall.
    if (arcTop > lipOffset || (smoothArc && lipOffset === 0)) {
      points.push([arcTop, height]);
    }
    const arcFrom = points.length - 1;
    if (style === 'curved' && !smoothArc) {
      // Concave quarter-ellipse from (arcTop, height) to (floorStart+run, 0),
      // each point pushed inboard by however far the wall has leaned in by
      // that point's height.
      for (let i = 1; i < segments; i++) {
        const angle = (Math.PI / 2) * (i / segments);
        const arcZ = height * (1 - Math.sin(angle));
        const arcY = arcTop + (wallAt(arcZ) - wallAtTop) + run * (1 - Math.cos(angle));
        points.push([arcY, arcZ]);
      }
    }
    // Floor, floorStart + run away from wall. For 'straight' style the
    // segment from the last wall point (arcTop, height) to here is the bevel
    // face; no intermediate arc points are added. Then straight down into the
    // floor so the closing edge back to the wall runs inside solid material.
    points.push([floorStart + run, 0]);
    points.push([floorStart + run, -floorPenetration]);

    // Draw the profile (will be sketched on YZ and extruded along X)
    let pen = draw(points[0]);
    for (let i = 1; i < points.length; i++) {
      pen =
        smoothArc && i === arcFrom + 1
          ? pen.cubicBezierCurveTo(
              points[i],
              [arcTop, height * (1 - QUARTER_ELLIPSE_K)],
              [points[i][0] - run * QUARTER_ELLIPSE_K, 0]
            )
          : pen.lineTo(points[i]);
    }
    const profile = pen.close();

    // Do not fillet the longitudinal rim edges (top-of-ramp at Y=arcTop,
    // Z=height; floor-of-ramp at Y=floorStart+run, Z=0). The curved arc is
    // tangent to the wall and floor at those points, so the edges sit at
    // polygon cusps — brepjs `fillet()` returns Ok but produces degenerate
    // topology that fails STL export.
    // Extrude longer than the span so both ends bury into the perpendicular
    // walls/dividers rather than landing coincident on their inner faces (see
    // `wallPenetration`). Centred, so `placement.alongCenter` still aligns it.
    const spanExtruded = span + 2 * wallPenetration;
    const scoopSolid = scope.register(
      sketch(profile, 'YZ', -spanExtruded / 2).extrude(spanExtruded)
    );

    // The profile above is authored facing front (wall at Y=0, ramp running
    // toward +Y). Rotating about +Z maps it onto whichever wall was chosen,
    // then the translation drops it on that compartment's edge.
    const oriented =
      placement.rotationDeg === 0
        ? scoopSolid
        : scope.register(rotate(scoopSolid, placement.rotationDeg, { axis: [0, 0, 1] }));

    const offset: [number, number, number] = placement.runsAlongY
      ? [placement.alongCenter, placement.edge, compFloorZ]
      : [placement.edge, placement.alongCenter, compFloorZ];

    ramps.push({
      compId,
      side,
      solid: scope.register(translate(oriented, offset)),
      climbed: climbs && !leans,
    });
  }
  return ramps;
}

function buildScoopRampsInScope(
  scope: DisposalScope,
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number,
  floorZ: number,
  floorRaiseFor: (compartmentId: number) => number,
  taper: ResolvedTaper | null
): Shape3D | null {
  const scoopShapes = buildScoopRampSolids(
    scope,
    params,
    innerW,
    innerD,
    wallHeight,
    wallThickness,
    floorZ,
    floorRaiseFor,
    taper
  )
    .filter((r) => !r.climbed)
    .map((r) => r.solid);
  return fuseScoopRamps(
    scope,
    params,
    scoopShapes,
    innerW,
    innerD,
    wallHeight,
    wallThickness,
    taper
  );
}

/** Ramp solids fused into one and clipped to the cavity, as the scoop feature fuses them. */
export function fuseScoopRamps(
  scope: DisposalScope,
  params: BinParams,
  scoopShapes: readonly Shape3D[],
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number,
  taper: ResolvedTaper | null
): Shape3D | null {
  const wallPenetration = scoopWallPenetration(params, wallThickness);

  // Inline fuse so the fused handle is registered in scope.
  if (scoopShapes.length === 0) return null;
  const fused =
    scoopShapes.length === 1
      ? scoopShapes[0] // already scope-registered
      : scope.register(unwrap(fuseAll(scoopShapes as ValidSolid[])));

  // The scoop is a square-cornered full-width prism, pushed `wallPenetration`
  // into the surrounding walls to weld it (above). At the bin's rounded outer
  // corners a square corner driven diagonally into the wall overshoots the outer
  // arc and pokes out of the bin, at any wall thickness once the penetration is
  // applied. Clip it to the inner cavity footprint grown by the penetration: the
  // rounded corners stay inside the outer wall (wallPenetration < wallThickness)
  // and the straight edges keep the weld depth, so the overshoot is trimmed but
  // the flat-face weld is not. Interior scoops sit inside the footprint (no-op).
  //
  // A bottom-band taper narrows the outer wall toward the floor, exactly where
  // the ramp stands, so a full-width ramp end on a tapered side would poke
  // through the tapered wall. There the clip has to follow the wall down, so use
  // the tapered inner envelope (grown by the same penetration) instead of a
  // prism. The ramp never dips below z=0 (its underside buries UP into the
  // floor), so the envelope's z=0 start contains it, and on untapered sides the
  // envelope is prismatic — so it subsumes the rounded-corner clip too.
  //
  // Built at the origin, like every other feature tool: the ramps above are
  // placed in the cavity-local frame and the feature runner translates the
  // finished shape by the asymmetric-overhang offset afterwards. Baking that
  // offset into the envelope shifts the clip twice, and a left-tapered bin
  // then carries its left ramp `offX` outside the wall.
  try {
    const cavityCornerR = Math.max(BOX_CORNER_RADIUS - wallThickness, 0.1);
    const clip = taper
      ? buildTaperedInnerEnvelope(
          innerW + 2 * wallThickness,
          innerD + 2 * wallThickness,
          wallHeight,
          wallThickness,
          taper,
          wallHeight + 2,
          0,
          0,
          wallPenetration
        )
      : sketch(
          drawRoundedRectangle(
            innerW + 2 * wallPenetration,
            innerD + 2 * wallPenetration,
            cavityCornerR + wallPenetration
          ),
          'XY',
          -1
        ).extrude(wallHeight + 2);
    const footprint = scope.register(clip);
    return scope.register(unwrap(intersect(fused as ValidSolid, footprint as ValidSolid)));
  } catch {
    // The clip only trims a sub-mm corner overshoot — best-effort, like the
    // other booleans here. A kernel failure must not sink the whole bin
    // build, so fall back to the un-clipped scoop.
    return fused;
  }
}

// --- FeatureBuilder protocol ---

import type { FeatureBuilder } from './pipeline/featureBuilder';
import { FeatureTag } from './featureTags';
import { buildCacheKey, quantize, stableSerialize, compactKey } from './cacheKeyUtils';

export const scoopRampsFeature: FeatureBuilder = {
  name: 'scoopRamps',
  tag: FeatureTag.SCOOP,
  target: 'fuse',
  // Mirrors the constraint rules; suppressed here too for any legacy design
  // carrying both.
  shouldBuild: (ctx) => scoopRampsApply(ctx.params, ctx.dimensions),
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
    return compactKey(
      buildCacheKey(
        'v9',
        dim.shellKey,
        stableSerialize(params.scoop),
        params.style,
        quantize(dim.innerW),
        quantize(dim.innerD),
        quantize(dim.wallHeight),
        quantize(dim.floorThickness),
        quantize(params.wallThickness),
        // The wall/divider penetration that welds the ramp to its host scales
        // with the divider thickness, so a thickness edit moves the geometry.
        quantize(params.compartments.thickness),
        dim.hasLip,
        params.compartments.cols,
        params.compartments.rows,
        params.compartments.cells.join(','),
        stableSerialize(params.compartments.dividerOverrides ?? []),
        quantize(dim.interiorHeight),
        stableSerialize(params.compartments.floorRaises ?? []),
        interiorFilletRadiusMm(params) > 0,
        params.walls.enabled
      )
    );
  },
  build: (ctx) => {
    const raises = resolveFloorRaises(
      ctx.params,
      ctx.dimensions.floorThickness,
      ctx.dimensions.interiorHeight
    );
    const result = buildScoopRamps(
      ctx.params,
      ctx.dimensions.innerW,
      ctx.dimensions.innerD,
      ctx.dimensions.wallHeight,
      ctx.params.wallThickness,
      ctx.dimensions.floorThickness,
      (id) => raises.get(id) ?? 0,
      // A tapered outer wall narrows toward the floor, so the ramp clips against
      // the tapered inner envelope rather than a prism, or it pokes through the
      // tapered wall.
      ctx.dimensions.overhang.taper
    );
    return result ? [result] : null;
  },
};
