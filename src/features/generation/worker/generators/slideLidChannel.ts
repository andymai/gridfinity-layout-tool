/**
 * The sliding lid's channel, on the bin side.
 *
 * Two shelves, two retainers, the detent bumps that hold the plate shut, and
 * the window the plate enters through. Placement comes entirely from
 * `resolveSlideLidPlan`, which is pure and tested without a kernel, so this
 * file only turns sections into solids — the plate that runs in the channel is
 * built from the SAME plan, which is what stops the two disagreeing about where
 * the bearing surfaces are.
 *
 * Everything is built in the plan's canonical frame (plate travels along X and
 * withdraws toward +X, `z = 0` at the plate's top plane), then rotated onto the
 * chosen entry wall and translated onto the cavity. One code path, one
 * rotation — the alternative is four hand-written orientations and three
 * chances to get a sign backwards.
 */

import {
  box,
  clone,
  cutAll,
  draw,
  drawRoundedRectangle,
  getBounds,
  intersect,
  rotate,
  translate,
  unwrap,
  withScope,
} from 'brepjs';
import type { DisposalScope, Shape3D, Sketch, ValidSolid } from 'brepjs';
import { sketch } from './meshUtils';
import type {
  SlideLidBar,
  SlideLidBox,
  SlideLidFootprint,
  SlideLidDetent,
  SlideLidGeometry,
  SlideLidMouthRelief,
  SlideLidWallLining,
} from '@/shared/utils/slideLidPlan';
import type { BinDimensions } from './pipeline/types';

/**
 * World Z of the plate's top plane.
 *
 * `dimensions.wallTopZ`, never `baseOffsetZ + totalHeight`: the latter
 * double-counts the socket and omits the `extraWallHeightMm` collar, and the
 * whole plan is stated against the wall top precisely so a collar carries the
 * joint up with it (CLAUDE.md gotcha #14).
 */
export function slideLidPlateTopZ(dim: BinDimensions, geometry: SlideLidGeometry): number {
  return dim.wallTopZ - geometry.plateTopBelowWallTopMm;
}

/**
 * How far the entry notch flares as it breaks the rim (mm), when it does.
 *
 * A rim break leaves the stacking lip ending at two vertical shoulders, which
 * is where an upper bin catches as it slides on and where a crack starts, so
 * the cut widens by this fixed run-out on each side as it climbs from the
 * plate's clearance height to the rim. Same treatment, and the same reason, as
 * `lidGripDipStage`'s ramped ends.
 */
const NOTCH_RIM_RAMP_MM = 2.5;

/** Coplanar bite (mm) so a fused bump has real volume to merge, not a face. */
const DETENT_BITE_MM = 0.2;

/** Sweep a YZ section along X — every bar, and every mouth relief. */
function barSolid(scope: DisposalScope, bar: SlideLidBar | SlideLidMouthRelief): Shape3D {
  const [first, ...rest] = bar.section;
  let pen = draw([first[0], first[1]]);
  for (const [y, z] of rest) pen = pen.lineTo([y, z]);
  const extruded = scope.register(sketch(pen.close(), 'YZ').extrude(bar.xMax - bar.xMin));
  return scope.register(translate(extruded, [bar.xMin, 0, 0]));
}

/**
 * A detent: a 45° gable in the XZ elevation, extruded across the shelf.
 *
 * Drawn in XY and stood upright with `rotate(+90, X)`, which maps
 * `(x, y, z) → (x, -z, y)` — the drawing's vertical becomes +Z and the
 * extrusion runs toward −Y. A −90 rotation would invert the vertical and build
 * the ramp DOWNWARD into the shelf, which is invisible on a symmetric profile
 * and silent here because a bump sunk into its own shelf still leaves a
 * watertight bin (CLAUDE.md gotcha #12).
 */
function detentSolid(scope: DisposalScope, detent: SlideLidDetent): Shape3D {
  const depth = detent.yMax - detent.yMin;
  const elevation = draw([detent.peakX - detent.runMm, -DETENT_BITE_MM])
    .lineTo([detent.peakX + detent.runMm, -DETENT_BITE_MM])
    .lineTo([detent.peakX, detent.riseMm])
    .close();
  const slab = scope.register(sketch(elevation, 'XY', 0).extrude(depth));
  const upright = scope.register(rotate(slab, 90, { axis: [1, 0, 0] }));
  return scope.register(translate(upright, [0, detent.yMax, detent.baseZ]));
}

/**
 * The entry window, as a YZ elevation swept along X.
 *
 * Rectangular up to the plate's clearance height, then flaring outward by a
 * fixed run-out each side as it climbs through the rim — see
 * {@link NOTCH_RIM_RAMP_MM}.
 */
function notchSolid(
  scope: DisposalScope,
  notch: SlideLidBox,
  plateClearTopZ: number,
  rampsRim: boolean
): Shape3D {
  // A notch that stops at the plate's clearance height leaves the rim standing,
  // so there is no rim break to ramp: a plain rectangle.
  const ramps = rampsRim && notch.zMax > plateClearTopZ + 1e-6;
  const bottom = draw([notch.yMin, notch.zMin]).lineTo([notch.yMax, notch.zMin]);
  const elevation = (
    ramps
      ? bottom
          .lineTo([notch.yMax, plateClearTopZ])
          .lineTo([notch.yMax + NOTCH_RIM_RAMP_MM, notch.zMax])
          .lineTo([notch.yMin - NOTCH_RIM_RAMP_MM, notch.zMax])
          .lineTo([notch.yMin, plateClearTopZ])
      : bottom.lineTo([notch.yMax, notch.zMax]).lineTo([notch.yMin, notch.zMax])
  ).close();
  const extruded = scope.register(sketch(elevation, 'YZ').extrude(notch.xMax - notch.xMin));
  return scope.register(translate(extruded, [notch.xMin, 0, 0]));
}

/** Clip a canonical solid to the body's outer footprint. */
function clipToFootprint(
  scope: DisposalScope,
  shape: Shape3D,
  footprint: SlideLidFootprint
): Shape3D {
  const { zMin, zMax } = getBounds(shape);
  const prism = scope.register(
    drawRoundedRectangle(footprint.lengthMm, footprint.spanMm, footprint.cornerRadiusMm)
      .sketchOnPlane('XY', zMin - 1)
      .extrude(zMax - zMin + 2)
  );
  return scope.register(unwrap(intersect(shape, prism)));
}

/** The body's outer footprint, inset by `inset`, as a canonical rounded rectangle at `z`. */
function liningSection(lining: SlideLidWallLining, inset: number, z: number): Sketch {
  return drawRoundedRectangle(
    lining.bodyLengthMm - 2 * inset,
    lining.bodySpanMm - 2 * inset,
    Math.max(lining.bodyCornerRadiusMm - inset, 0.05)
  ).sketchOnPlane('XY', z) as Sketch;
}

/**
 * The ring lining a thin wall out to the channel's face, over the joint's band.
 *
 * Starts 0.1mm inside the wall so the fuse has volume to merge, and chamfers
 * 45° back to the wall under its bottom so the ledge never overhangs.
 */
function liningSolid(scope: DisposalScope, lining: SlideLidWallLining): Shape3D {
  const { zMin, zMax, channelInsetMm, cavityInsetMm } = lining;
  const grown = cavityInsetMm - 0.1;
  const run = channelInsetMm - cavityInsetMm;
  const outer = scope.register(liningSection(lining, grown, zMin - run).extrude(zMax - zMin + run));
  const chamfer = scope.register(
    liningSection(lining, grown, zMin - run - 0.1).loftWith(
      [liningSection(lining, channelInsetMm, zMin)],
      { ruled: true }
    )
  );
  const core = scope.register(liningSection(lining, channelInsetMm, zMin).extrude(zMax - zMin + 1));
  const bottom = zMin - run - 0.2;
  const height = zMax + 1 - bottom;
  const openings = lining.openings.map((o) =>
    scope.register(
      box(o.xMax - o.xMin, o.yMax - o.yMin, height, {
        at: [(o.xMin + o.xMax) / 2, (o.yMin + o.yMax) / 2, bottom + height / 2],
      })
    )
  );
  return scope.register(
    unwrap(cutAll(outer as ValidSolid, [chamfer, core, ...openings] as ValidSolid[]))
  );
}

/** Rotate a canonical solid onto the entry wall and drop it onto the cavity. */
function place(
  scope: DisposalScope,
  shape: Shape3D,
  rotationDeg: number,
  offsetX: number,
  offsetY: number,
  plateTopZ: number
): Shape3D {
  const oriented =
    rotationDeg === 0 ? shape : scope.register(rotate(shape, rotationDeg, { axis: [0, 0, 1] }));
  return scope.register(translate(oriented, [offsetX, offsetY, plateTopZ]));
}

/** The channel's additive and subtractive halves, ready to apply to the bin. */
export interface SlideLidChannelSolids {
  /**
   * A thin wall's lining out to the channel's face. Fused FIRST: the mouth
   * relief and the bars are both laid out against that face.
   */
  readonly linings: readonly Shape3D[];
  /**
   * The cavity's entry corner arcs — cut BEFORE the additions fuse, so the
   * bars land back in the space this opens instead of being sawn off inside
   * the arcs they run into.
   */
  readonly mouthCuts: readonly Shape3D[];
  /** The entry window — cut from the bin, before the additions fuse. */
  readonly subtractions: readonly Shape3D[];
  /** Shelves, retainers and detents — fused onto the bin. */
  readonly additions: readonly Shape3D[];
  /** Cut AFTER the fuse: a finger catch's lip cut, ending the retainers flush with it. */
  readonly finishingCuts: readonly Shape3D[];
}

/**
 * Build the channel in world coordinates.
 *
 * The caller owns every returned solid. Returned as one list per step rather
 * than applied here because the ORDER matters and belongs to the stage: the
 * lining first, then the mouth relief and notch BEFORE the bars fuse, and the
 * finishing cuts after. Cut after the fuse, the mouth relief would take the
 * shelf and retainer away with the corner arc they run into, and the notch
 * would saw the entry bars off inside the window they line. The bars never
 * reach into the plate's slot, so refilling the window with them leaves it open.
 */
export function buildSlideLidChannel(
  geometry: SlideLidGeometry,
  plateTopZ: number,
  innerOffsetX: number,
  innerOffsetY: number
): SlideLidChannelSolids {
  const linings: Shape3D[] = [];
  const finishingCuts: Shape3D[] = [];
  const mouthCuts: Shape3D[] = [];
  const additions: Shape3D[] = [];
  const subtractions: Shape3D[] = [];

  withScope((scope: DisposalScope) => {
    const put = (built: Shape3D, into: Shape3D[]): void => {
      const positioned = place(
        scope,
        built,
        geometry.rotationDeg,
        innerOffsetX,
        innerOffsetY,
        plateTopZ
      );
      // Cloned out of the scope: it releases every intermediate when it closes,
      // and these have to outlive it.
      into.push(unwrap(clone(positioned)));
    };

    for (const relief of geometry.mouthReliefs) put(barSolid(scope, relief), mouthCuts);
    if (geometry.wallLining) put(liningSolid(scope, geometry.wallLining), linings);
    for (const bar of geometry.bars) put(barSolid(scope, bar), additions);
    for (const bar of geometry.entryBars) {
      put(clipToFootprint(scope, barSolid(scope, bar), geometry.bodyFootprint), additions);
    }
    for (const detent of geometry.detents) put(detentSolid(scope, detent), additions);
    put(
      notchSolid(scope, geometry.entryNotch, geometry.clearanceMm, geometry.entryNotchFlares),
      subtractions
    );
    if (geometry.lipNotch) {
      put(notchSolid(scope, geometry.lipNotch, geometry.clearanceMm, false), finishingCuts);
    }
    return null;
  });

  return { linings, mouthCuts, additions, subtractions, finishingCuts };
}
