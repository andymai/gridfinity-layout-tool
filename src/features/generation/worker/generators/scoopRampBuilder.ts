/**
 * Finger scoop ramp builder for Gridfinity bins.
 *
 * Generates concave quarter-cylinder ramps at the chosen edge of each compartment
 * to help slide items out of the bin.
 */

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
import type { BinParams } from '@/shared/types/bin';
import { sketch } from './meshUtils';
import {
  resolveScoopProfile,
  resolveScoopPlacement,
  resolveScoopSide,
  computeLipOffset,
  computeInteriorHeight,
} from '@/shared/utils/scoopCalculations';
import {
  LIP_SMALL_TAPER,
  LIP_TAPER_WIDTH,
  BOX_CORNER_RADIUS,
  COPLANAR_MARGIN,
} from './generatorConstants';
import { findCompartmentBounds } from './compartmentBuilder';
import { compartmentHasTiltedEdge, isRectangularCompartment } from '@/shared/types/bin';
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
 * @returns Fused ramp shape, or null if no scoops were built
 */
export function buildScoopRamps(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number
): Shape3D | null {
  if (!params.scoop.enabled) return null;
  if (params.style !== 'standard') return null;

  return withScope((scope: DisposalScope): Shape3D | null => {
    const fused = buildScoopRampsInScope(scope, params, innerW, innerD, wallHeight, wallThickness);
    // Clone so scope can dispose the fused original on exit.
    return fused ? unwrap(clone(fused)) : null;
  });
}

function buildScoopRampsInScope(
  scope: DisposalScope,
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number
): Shape3D | null {
  const hasLip = params.base.stackingLip;
  const interiorHeight = computeInteriorHeight(wallHeight, hasLip, LIP_SMALL_TAPER);

  // The ramp's back edge and its two span ends sit on the surrounding walls'
  // inner faces. Merely TOUCHING those faces leaves zero-thickness coincident
  // faces when the ramp is fused into the body — non-manifold membranes (they
  // surface as degenerate slivers where the ramp arc meets a side wall).
  // Socketed bins hide it: the export-time deferred-socket fuse recomputes the
  // boundary and heals it. A socketless base (flat / tray) never runs that fuse,
  // so the membrane ships straight into the STL as a gap. Push the contact
  // faces INTO the surrounding material so the fuse overlaps instead,
  // following the COPLANAR_MARGIN pattern used throughout the pipeline. Clamp
  // below the outer wall thickness (never breach it) AND below 0.4× the divider
  // thickness so two neighbouring compartments penetrating a shared divider from
  // opposite sides still cannot meet through it.
  const wallPenetration = Math.min(
    COPLANAR_MARGIN,
    wallThickness * 0.6,
    params.compartments.thickness * 0.4
  );

  const { cols, rows, cells } = params.compartments;
  const side = resolveScoopSide(params.scoop);

  const processedCompartments = new Set<number>();
  const scoopShapes: Shape3D[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const compId = cells[row * cols + col];
      if (processedCompartments.has(compId)) continue;
      processedCompartments.add(compId);

      // Scoop ramps assume axis-aligned compartment floors. When a divider
      // override tilts one of this compartment's walls, the floor becomes a
      // wedge/trapezoid and the ramp math no longer applies. Silently skip;
      // the UI surfaces a tooltip explaining why.
      if (compartmentHasTiltedEdge(params.compartments, compId)) continue;

      // Same reasoning for a merged L, S or U: the ramp spans the compartment's
      // bounding-box wall, which on those crosses the notch into a neighbour.
      if (!isRectangularCompartment(params.compartments, compId)) continue;

      const bounds = findCompartmentBounds(compId, cols, rows, cells);
      if (!bounds) continue;

      const placement = resolveScoopPlacement(side, bounds, { cols, rows, innerW, innerD });
      const { span, depth, isOuter } = placement;

      const lipOffset = computeLipOffset(hasLip, isOuter, LIP_TAPER_WIDTH, wallThickness);
      const scoopProfile = resolveScoopProfile(
        params.scoop,
        span,
        depth,
        isOuter,
        hasLip,
        wallHeight,
        interiorHeight,
        lipOffset
      );
      if (!scoopProfile) continue;
      const { run, height, style } = scoopProfile;

      // Build scoop ramp solid.
      // Profile in YZ plane: draw([u, v]) where u->Y (depth), v->Z (height).
      // The ramp descends from (lipOffset, height) to (lipOffset + run, 0):
      // a concave quarter-ellipse ('curved') or a straight bevel ('straight').
      // Without lip offset (lipOffset = 0):
      //   (0, 0) -> (0, H) -> ramp -> (run, 0) -> close
      // With lip offset (lo), extends to wallHeight so scoop meets lip:
      //   (0, 0) -> (0, wH) -> (lo, wH) -> (lo, H) -> ramp -> (lo+run, 0) -> close
      //   Goes up the wall to wallHeight, across to the lip's inner face,
      //   down to ramp start at H, then descends to floor. Fills solid.
      // The wall-hugging back edge is authored at `-wallPenetration` (inside the
      // wall) rather than 0 (on its inner face) so the fuse overlaps material;
      // see `wallPenetration` above. The visible ramp surface (arc + top edge at
      // Y=lipOffset) is unchanged.
      const backY = -wallPenetration;
      const segments = 24;
      const points: [number, number][] = [];
      // Start at wall/floor corner
      points.push([backY, 0]);
      if (lipOffset > 0) {
        // Up the wall to wallHeight (lip base), across to lip inner face
        points.push([backY, wallHeight]);
        points.push([lipOffset, wallHeight]);
        // Down to ramp start (only needed when height < wallHeight)
        if (height < wallHeight) {
          points.push([lipOffset, height]);
        }
      } else {
        // Standard: up the wall to scoop height
        points.push([backY, height]);
      }
      if (style === 'curved') {
        // Concave quarter-ellipse from (lipOffset, height) to (lipOffset+run, 0)
        for (let i = 1; i < segments; i++) {
          const angle = (Math.PI / 2) * (i / segments);
          const arcY = lipOffset + run * (1 - Math.cos(angle));
          const arcZ = height * (1 - Math.sin(angle));
          points.push([arcY, arcZ]);
        }
      }
      // Floor, lipOffset + run away from wall. For 'straight' style the segment
      // from the last wall point (lipOffset, height) to here is the bevel face;
      // no intermediate arc points are added.
      points.push([lipOffset + run, 0]);

      // Draw the profile (will be sketched on YZ and extruded along X)
      let pen = draw(points[0]);
      for (let i = 1; i < points.length; i++) {
        pen = pen.lineTo(points[i]);
      }
      const profile = pen.close();

      // Do not fillet the longitudinal rim edges (top-of-ramp at Y=lipOffset,
      // Z=height; floor-of-ramp at Y=lipOffset+run, Z=0). The curved arc is
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
        ? [placement.alongCenter, placement.edge, 0]
        : [placement.edge, placement.alongCenter, 0];

      scoopShapes.push(scope.register(translate(oriented, offset)));
    }
  }

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
  try {
    const cavityCornerR = Math.max(BOX_CORNER_RADIUS - wallThickness, 0.1);
    const footprint = scope.register(
      sketch(
        drawRoundedRectangle(
          innerW + 2 * wallPenetration,
          innerD + 2 * wallPenetration,
          cavityCornerR + wallPenetration
        ),
        'XY',
        -1
      ).extrude(wallHeight + 2)
    );
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
  // A ramp needs solid material to rest on. `liteFloorOpen`, not `lightweight`:
  // the interior mode and a spacer leave nothing under the ramp but cup
  // recesses, while the underside relief keeps the floor a standard bin has, so
  // the ramp lands on solid material exactly as it always did. Mirrors the
  // constraint rule; suppressed here too for any legacy design carrying both.
  shouldBuild: (ctx) => !ctx.dimensions.isSlotted && !ctx.dimensions.liteFloorOpen,
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
    return compactKey(
      buildCacheKey(
        'v5',
        dim.shellKey,
        stableSerialize(params.scoop),
        params.style,
        quantize(dim.innerW),
        quantize(dim.innerD),
        quantize(dim.wallHeight),
        quantize(params.wallThickness),
        // The wall/divider penetration that welds the ramp to its host scales
        // with the divider thickness, so a thickness edit moves the geometry.
        quantize(params.compartments.thickness),
        dim.hasLip,
        params.compartments.cols,
        params.compartments.rows,
        params.compartments.cells.join(','),
        stableSerialize(params.compartments.dividerOverrides ?? [])
      )
    );
  },
  build: (ctx) => {
    const result = buildScoopRamps(
      ctx.params,
      ctx.dimensions.innerW,
      ctx.dimensions.innerD,
      ctx.dimensions.wallHeight,
      ctx.params.wallThickness
    );
    return result ? [result] : null;
  },
};
