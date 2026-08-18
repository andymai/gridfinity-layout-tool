/**
 * Lid interior relief — carve the seating envelope out of the cavity.
 *
 * The last operation on the bin's interior, and that placement is the feature,
 * not an implementation detail: every interior builder runs above it in the
 * pipeline, so anything added later is trimmed without its author knowing the
 * lid exists. Four defects in this family shipped because each new feature had
 * to be told about the rail band separately.
 *
 * ORDER. After `translateStage`, so Z is final world Z. BEFORE
 * `lidRetentionStage`: a magnetic lid's corner pads weld into the interior
 * walls and rise to the mating plane by design, so they are part of
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

import { draw, cut, fuseAll, translate, unwrap } from 'brepjs';
import type { Shape3D, ValidSolid, Drawing } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { interiorReliefActive, isSlideLid, slideLidPlanForParams } from '@/shared/types/bin';
import { slideTravelsAlongX } from '@/shared/utils/slideLidPlan';
import { slideLidPlateTopZ } from '../../slideLidChannel';
import { lidKeepoutRing, lidKeepoutSlabs } from '@/shared/constants/lidKeepout';
import { isPartialMask, type CellMask } from '@/shared/utils/cellMask';
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

/**
 * A built cutter plus every intermediate handle the caller must dispose.
 *
 * Returned rather than scoped because the cutter outlives the builder — it is
 * tagged and then cut against the bin — and each brepjs transform allocates a
 * WASM handle whose predecessor becomes garbage. Leaking them across
 * regenerations exhausts the heap.
 */
interface BuiltRing {
  readonly solid: Shape3D;
  readonly scratch: readonly Shape3D[];
}

/** The rectangular ring: an outer rounded rect less its inset copy. */
function buildRectRing(
  ring: ReturnType<typeof lidKeepoutRing>,
  innerHalfX: number,
  innerHalfY: number,
  bottomZ: number,
  height: number
): BuiltRing {
  const outer = roundedRect(ring.outerHalfX, ring.outerHalfY, ring.cornerRadius);
  const inner = roundedRect(innerHalfX, innerHalfY, Math.max(ring.cornerRadius - ring.width, 0));
  const outerSolid = outer.sketchOnPlane('XY', bottomZ).extrude(height);
  const innerSolid = inner.sketchOnPlane('XY', bottomZ).extrude(height);
  return {
    solid: unwrap(cut(outerSolid as ValidSolid, innerSolid as ValidSolid)),
    scratch: [outerSolid, innerSolid],
  };
}

/**
 * The custom-shape ring: one band per outline edge, fused.
 *
 * Null when the outline yields no band at all — a footprint whose every edge is
 * shorter than the band's own trim, which leaves nothing to relieve.
 */
function buildPolygonRing(
  mask: CellMask,
  gridUnitMm: number,
  gridUnitMmY: number,
  wallThickness: number,
  bottomZ: number,
  height: number
): BuiltRing | null {
  const slabs = lidKeepoutSlabs(mask, gridUnitMm, gridUnitMmY, wallThickness);
  if (slabs.length === 0) return null;

  const parts: Shape3D[] = slabs.map((s) =>
    draw([s.minX, s.minY])
      .lineTo([s.maxX, s.minY])
      .lineTo([s.maxX, s.maxY])
      .lineTo([s.minX, s.maxY])
      .close()
      .sketchOnPlane('XY', bottomZ)
      .extrude(height)
  );
  if (parts.length === 1) return { solid: parts[0], scratch: [] };
  // The bands overlap by construction at every corner, so the fuse is what
  // makes them one cutter rather than a row of touching boxes whose shared
  // faces would leave coincident geometry in the result.
  return { solid: unwrap(fuseAll(parts as ValidSolid[])), scratch: parts };
}

/**
 * Cut the sliding plate's travel envelope out of the cavity.
 *
 * A slab spanning the whole opening, because that is what the plate sweeps —
 * a divider in the middle of the grid stops the plate exactly as dead as one
 * against a wall, and neither is visible to any check on either solid alone.
 *
 * Its TOP is the retainer's top plane, deliberately not the wall top. On the
 * recessed placement everything above that belongs to the stacking lip, and a
 * cutter reaching into the lip's angled support would back-fill the taper a
 * foot has to seat in — a bin that looks perfect and will not sit in a
 * baseplate (CLAUDE.md gotcha #10).
 */
function relieveSlideTravel(ctx: PipelineContext): PipelineContext {
  if (!ctx.solid) return ctx;
  const { params, dimensions: dim } = ctx;
  const { geometry } = slideLidPlanForParams(params);
  if (!geometry) return ctx;

  const env = geometry.travelEnvelope;
  const plateTopZ = slideLidPlateTopZ(dim, geometry);
  const height = env.zMax - env.zMin;
  if (height <= 0) return ctx;

  const travelsX = slideTravelsAlongX(geometry.entrySide);
  // The plan is canonical (travel along X); the envelope is an axis-aligned box
  // and its only orientation-dependent property is which extent belongs to
  // which axis, so swapping them is the whole rotation.
  const halfX = (travelsX ? env.xMax - env.xMin : env.yMax - env.yMin) / 2;
  const halfY = (travelsX ? env.yMax - env.yMin : env.xMax - env.xMin) / 2;

  const slab = draw([-halfX, -halfY])
    .lineTo([halfX, -halfY])
    .lineTo([halfX, halfY])
    .lineTo([-halfX, halfY])
    .close()
    .sketchOnPlane('XY', plateTopZ + env.zMin)
    .extrude(height);

  const positioned: Shape3D =
    dim.innerOffsetX === 0 && dim.innerOffsetY === 0
      ? slab
      : translate(slab, [dim.innerOffsetX, dim.innerOffsetY, 0]);

  collectOrigins(positioned, FeatureTag.LID_RELIEF, ctx.originToTag);

  const result = unwrap(cut(ctx.solid as ValidSolid, positioned as ValidSolid));
  if (positioned !== slab) positioned.delete();
  slab.delete();
  if (result !== ctx.solid) ctx.solid.delete();

  return { ...ctx, solid: result };
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
    // A sliding plate sweeps the whole opening, not a band at the walls, so its
    // envelope is a slab rather than a ring and there is no inset to compute.
    // Same placement in the pipeline and the same guarantee: a feature added
    // later is trimmed without its author knowing the lid exists.
    if (isSlideLid(params.lid)) return relieveSlideTravel(ctx);

    const ring = lidKeepoutRing(dim.innerW, dim.innerD, params.wallThickness);
    if (ring.width <= 0) return ctx;

    const innerHalfX = ring.outerHalfX - ring.width;
    const innerHalfY = ring.outerHalfY - ring.width;
    // A cavity narrower than two ring widths has no interior left to keep, so
    // the ring would degenerate into a plain slab. Leave such a bin alone
    // rather than hollowing its whole mouth. Checked on the bounding cavity,
    // which is the polygon case's guard too — a footprint whose BOUNDS are that
    // tight has no usable interior on any outline.
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

    const mask = params.cellMask;
    // A custom shape's ring follows its own outline, so it is built as the union
    // of one band per edge rather than as a rounded rectangle less its inset
    // copy. `lidKeepoutSlabs` explains why that is a construction and
    // not an approximation.
    const built = isPartialMask(mask)
      ? buildPolygonRing(
          mask,
          params.gridUnitMm,
          params.gridUnitMmY ?? params.gridUnitMm,
          params.wallThickness,
          bottomZ,
          height
        )
      : buildRectRing(ring, innerHalfX, innerHalfY, bottomZ, height);
    if (!built) return ctx;
    const { solid: ringSolid, scratch } = built;

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
    for (const s of scratch) s.delete();
    if (positioned !== ringSolid) positioned.delete();
    ringSolid.delete();
    if (result !== ctx.solid) ctx.solid.delete();

    return { ...ctx, solid: result };
  },
};
