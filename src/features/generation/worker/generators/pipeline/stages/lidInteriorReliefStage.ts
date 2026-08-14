/**
 * Lid interior relief — carve the seating envelope out of the cavity (#3477).
 *
 * The last operation on the bin's interior, and that placement is the feature,
 * not an implementation detail: every interior builder runs above it in the
 * pipeline, so anything added later is trimmed without its author knowing the
 * lid exists. Four defects in this family shipped because each new feature had
 * to be told about the rail band separately (#3401, #3434, #3450, #3477).
 *
 * ORDER. After `translateStage`, so Z is final world Z. BEFORE
 * `lidRetentionStage`: a magnetic lid's corner pads weld into the interior
 * walls and rise to the mating plane by design (#3450), so they are part of
 * the interface rather than contents, and cutting them would break the very
 * fit they exist for.
 *
 * SHAPE. A continuous ring, sized to the click-rail case, cut whenever a lid is
 * generated — not per-side and not per-attachment. That keeps the bin's
 * interior independent of the lid's options: toggling one rail side, or
 * switching friction↔click, leaves the bin byte-identical, and the shell cache
 * key takes one bit instead of the whole rail plan. A friction lid gives up
 * ~3mm of divider height at the wall for it, which is the price of the
 * interior not depending on which lid you picked today.
 *
 * The ring's bounds come from `lidKeepoutRing`, which explains why its outer
 * edge stops at the stacking lip's inner face rather than the wall's: the void
 * under the lip's jut IS the undercut the rail hooks, and a cutter that
 * overshot upward into it would silently disable the snap.
 */

import { draw, cut, translate, unwrap } from 'brepjs';
import type { Shape3D, ValidSolid, Drawing } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { interiorReliefActive } from '@/shared/types/bin';
import { lidKeepoutRing } from '@/shared/constants/lidKeepout';
import { checkCancelled } from '../../utils/abort';
import { FeatureTag } from '../../featureTags';
import { collectOrigins } from '../collectOrigins';

/** Rounded rectangle centred on the origin, drawn from an edge midpoint so
 *  `close()` forms a real edge through the last corner. */
function roundedRect(halfX: number, halfY: number, radius: number): Drawing {
  const r = Math.max(0, Math.min(radius, halfX - 0.05, halfY - 0.05));
  if (r <= 0.1) {
    return draw([0, -halfY])
      .lineTo([halfX, -halfY])
      .lineTo([halfX, halfY])
      .lineTo([-halfX, halfY])
      .lineTo([-halfX, -halfY])
      .close();
  }
  return draw([0, -halfY])
    .lineTo([halfX, -halfY])
    .customCorner(r)
    .lineTo([halfX, halfY])
    .customCorner(r)
    .lineTo([-halfX, halfY])
    .customCorner(r)
    .lineTo([-halfX, -halfY])
    .customCorner(r)
    .close();
}

export const lidInteriorReliefStage: PipelineStage = {
  name: 'merge',
  progressValue: 0.82,

  shouldRun(ctx: PipelineContext): boolean {
    // `interiorReliefActive` is the one gate: the rail planner, the label
    // shelf's datum and the scoop warning all read it too, so the bin cannot
    // end up relieved while the rails still notch around features that moved.
    return ctx.solid !== null && interiorReliefActive(ctx.params);
  },

  execute(ctx: PipelineContext): PipelineContext {
    if (!ctx.solid) return ctx;
    checkCancelled(ctx.signal);

    const { params, dimensions: dim } = ctx;
    const ring = lidKeepoutRing(dim.innerW, dim.innerD, params.wallThickness);
    if (ring.width <= 0) return ctx;

    const innerHalfX = ring.outerHalfX - ring.width;
    const innerHalfY = ring.outerHalfY - ring.width;
    // A cavity narrower than two ring widths has no interior left to keep, so
    // the ring would degenerate into a plain slab. Leave such a bin alone
    // rather than hollowing its whole mouth.
    if (innerHalfX <= 0.1 || innerHalfY <= 0.1) return ctx;

    // Bottom at the rail's deepest reach plus clearance, measured from the wall
    // top — which is what the band constant is stated against, so a collar
    // carries the envelope up with it.
    //
    // The top lands halfway up the lip's small taper: already clear of the
    // interior ceiling a full taper below, so every scrap of divider is cut,
    // and still short of the wall top. Both bounds matter. Stopping ON the
    // ceiling or ON the wall top would leave the cutter's face coplanar with
    // real geometry, which is what leaves the odd crossing counts that break a
    // span-pairing probe; overshooting ABOVE the wall top puts cut vertices in
    // the lip's own Z band, where nothing of this feature belongs.
    const bottomZ = dim.wallTopZ - ring.depthBelowWallTop;
    // Up to the wall top exactly. Measured, not assumed: stopping even 0.1mm
    // short leaves a web of material bridging the divider tops to the wall
    // across the ring, and the seating probe goes from clean to 3.05mm. Not
    // one millimetre higher either — anything above the wall top puts this
    // feature's vertices in the lip's own Z band.
    const topZ = dim.wallTopZ;
    const height = topZ - bottomZ;

    const outer = roundedRect(ring.outerHalfX, ring.outerHalfY, ring.cornerRadius);
    const inner = roundedRect(innerHalfX, innerHalfY, Math.max(ring.cornerRadius - ring.width, 0));
    const outerSolid = outer.sketchOnPlane('XY', bottomZ).extrude(height);
    const innerSolid = inner.sketchOnPlane('XY', bottomZ).extrude(height);
    const ringSolid = unwrap(cut(outerSolid as ValidSolid, innerSolid as ValidSolid));

    // The interior is translated by the overhang offset, so the envelope has to
    // follow it or an asymmetric bin gets relieved off-centre.
    const positioned: Shape3D =
      dim.innerOffsetX === 0 && dim.innerOffsetY === 0
        ? ringSolid
        : translate(ringSolid, [dim.innerOffsetX, dim.innerOffsetY, 0]);

    // Tag the CUTTER, never the result: `setShapeOrigin` replaces a shape's
    // whole face-origin map, so tagging the post-boolean solid would stamp the
    // entire bin.
    collectOrigins(positioned, FeatureTag.LID_RELIEF, ctx.originToTag);

    const result = unwrap(cut(ctx.solid as ValidSolid, positioned as ValidSolid));
    outerSolid.delete();
    innerSolid.delete();
    if (positioned !== ringSolid) positioned.delete();
    ringSolid.delete();
    if (result !== ctx.solid) ctx.solid.delete();

    return { ...ctx, solid: result };
  },
};
