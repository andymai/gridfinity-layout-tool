/**
 * Finger scoop ramp builder for Gridfinity bins.
 *
 * Generates concave quarter-cylinder ramps at the front edge of each compartment
 * to help slide items out of the bin.
 */

import {
  draw,
  drawRoundedRectangle,
  translate,
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
  computeLipOffset,
  computeInteriorHeight,
} from '@/shared/utils/scoopCalculations';
import { LIP_SMALL_TAPER, LIP_TAPER_WIDTH, BOX_CORNER_RADIUS } from './generatorConstants';
import { findCompartmentBounds } from './compartmentBuilder';
import { compartmentHasTiltedEdge } from '@/shared/types/bin';
/**
 * Build finger scoop ramps that curve from the bin floor up to the front wall.
 *
 * Each scoop is a solid ramp with a concave quarter-cylinder inner surface,
 * fused into the bin interior at the front edge of each compartment. The
 * ramp fills the wall-floor junction and the concave curve helps slide
 * items out of the bin.
 *
 * Scoops are placed at the front edge of every compartment row.
 * For merged compartments spanning multiple columns, a single scoop spans
 * the full merged width.
 *
 * When the bin has a stacking lip and the scoop is at the outer front wall
 * (row 0), the scoop is offset inward by the lip overhang so its top edge
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

  const { cols, rows, cells } = params.compartments;

  const cellW = innerW / cols;
  const cellD = innerD / rows;

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

      const bounds = findCompartmentBounds(compId, cols, rows, cells);
      if (!bounds) continue;

      const { minCol, maxCol, minRow, maxRow } = bounds;
      const compCols = maxCol - minCol + 1;
      const compRows = maxRow - minRow + 1;
      const compW = compCols * cellW;
      const compD = compRows * cellD;

      const isMinRow = minRow === 0;
      const lipOffset = computeLipOffset(hasLip, isMinRow, LIP_TAPER_WIDTH, wallThickness);
      const scoopProfile = resolveScoopProfile(
        params.scoop,
        compW,
        compD,
        isMinRow,
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
      const segments = 24;
      const points: [number, number][] = [];
      // Start at wall/floor corner
      points.push([0, 0]);
      if (lipOffset > 0) {
        // Up the wall to wallHeight (lip base), across to lip inner face
        points.push([0, wallHeight]);
        points.push([lipOffset, wallHeight]);
        // Down to ramp start (only needed when height < wallHeight)
        if (height < wallHeight) {
          points.push([lipOffset, height]);
        }
      } else {
        // Standard: up the wall to scoop height
        points.push([0, height]);
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
      const scoopSolid = scope.register(sketch(profile, 'YZ', -compW / 2).extrude(compW));

      // Position: center X at compartment center, Y at front edge of compartment
      const compCenterX = -innerW / 2 + (minCol + compCols / 2) * cellW;
      const frontEdgeY = -innerD / 2 + minRow * cellD;

      scoopShapes.push(scope.register(translate(scoopSolid, [compCenterX, frontEdgeY, 0])));
    }
  }

  // Inline fuse so the fused handle is registered in scope.
  if (scoopShapes.length === 0) return null;
  const fused =
    scoopShapes.length === 1
      ? scoopShapes[0] // already scope-registered
      : scope.register(unwrap(fuseAll(scoopShapes as ValidSolid[])));

  // Thin-walled bins round the inner cavity corners to radius
  // (BOX_CORNER_RADIUS − wallThickness), but the scoop is a straight full-width
  // prism with SQUARE corners. At the bin's front-outer corners those square
  // corners poke through the rounded outer wall and stick out of the bin. Below
  // the geometric threshold wallThickness < BOX_CORNER_RADIUS·(1 − 1/√2) the
  // square corner overshoots the outer arc (same condition the cavity cut
  // guards in compartmentBuilder, #1968). Clip the scoop to the rounded inner
  // footprint so its corners follow the wall; skip the boolean above the
  // threshold where there is nothing to trim.
  if (wallThickness < BOX_CORNER_RADIUS * (1 - Math.SQRT1_2)) {
    try {
      const cavityCornerR = Math.max(BOX_CORNER_RADIUS - wallThickness, 0.1);
      const footprint = scope.register(
        sketch(drawRoundedRectangle(innerW, innerD, cavityCornerR), 'XY', -1).extrude(
          wallHeight + 2
        )
      );
      return scope.register(unwrap(intersect(fused as ValidSolid, footprint as ValidSolid)));
    } catch {
      // The clip only trims a sub-mm corner overshoot — best-effort, like the
      // other booleans here. A kernel failure must not sink the whole bin
      // build, so fall back to the un-clipped scoop.
      return fused;
    }
  }
  return fused;
}

// --- FeatureBuilder protocol ---

import type { FeatureBuilder } from './pipeline/featureBuilder';
import { FeatureTag } from './featureTags';
import { buildCacheKey, quantize, stableSerialize, compactKey } from './cacheKeyUtils';

export const scoopRampsFeature: FeatureBuilder = {
  name: 'scoopRamps',
  tag: FeatureTag.SCOOP,
  target: 'fuse',
  // Lightweight floors have no solid material for a ramp to rest on (it would
  // bridge the cup recesses), so the scoop is mutually exclusive with lightweight
  // in the UI; suppress it here too for any legacy design carrying both.
  shouldBuild: (ctx) => !ctx.dimensions.isSlotted && !ctx.dimensions.lightweight,
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
    return compactKey(
      buildCacheKey(
        'v3',
        dim.shellKey,
        stableSerialize(params.scoop),
        params.style,
        quantize(dim.innerW),
        quantize(dim.innerD),
        quantize(dim.wallHeight),
        quantize(params.wallThickness),
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
