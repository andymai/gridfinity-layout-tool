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

import { clone, draw, rotate, translate, unwrap, withScope } from 'brepjs';
import type { Shape3D, DisposalScope } from 'brepjs';
import { sketch } from './meshUtils';
import type {
  SlideLidBar,
  SlideLidBox,
  SlideLidDetent,
  SlideLidGeometry,
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
 * How far the entry notch flares as it breaks the rim (mm).
 *
 * The window has to reach through the wall top — bounding it at the plate's own
 * height would leave the wall above spanning the whole opening as a horizontal
 * bridge, and past a 1-wide bin that is tens of millimetres of unsupported
 * lintel. Breaking the rim leaves the stacking lip ending at two vertical
 * shoulders instead, which is where an upper bin catches as it slides on and
 * where a crack starts, so the cut widens by this fixed run-out on each side
 * as it climbs from the plate's clearance height to the rim (the slope varies
 * with that rise). Same treatment, and the same reason, as `lidGripDipStage`'s
 * ramped ends.
 */
const NOTCH_RIM_RAMP_MM = 2.5;

/** Coplanar bite (mm) so a fused bump has real volume to merge, not a face. */
const DETENT_BITE_MM = 0.2;

/** Sweep a bar's YZ section along X. */
function barSolid(scope: DisposalScope, bar: SlideLidBar): Shape3D {
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
function notchSolid(scope: DisposalScope, notch: SlideLidBox, plateClearTopZ: number): Shape3D {
  // Guard the degenerate case where the flare would start above the cut's own
  // top: then it is a plain rectangle and the ramp has nothing to run out over.
  const flareBase = Math.min(plateClearTopZ, notch.zMax);
  const elevation = draw([notch.yMin, notch.zMin])
    .lineTo([notch.yMax, notch.zMin])
    .lineTo([notch.yMax, flareBase])
    .lineTo([notch.yMax + NOTCH_RIM_RAMP_MM, notch.zMax])
    .lineTo([notch.yMin - NOTCH_RIM_RAMP_MM, notch.zMax])
    .lineTo([notch.yMin, flareBase])
    .close();
  const extruded = scope.register(sketch(elevation, 'YZ').extrude(notch.xMax - notch.xMin));
  return scope.register(translate(extruded, [notch.xMin, 0, 0]));
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
  /** Shelves, retainers and detents — fused onto the bin. */
  readonly additions: readonly Shape3D[];
  /** The entry window — cut from the bin, after the additions fuse. */
  readonly subtractions: readonly Shape3D[];
}

/**
 * Build the channel in world coordinates.
 *
 * The caller owns every returned solid. Returned as two lists rather than
 * applied here because the order matters and belongs to the stage: the notch
 * has to be cut AFTER the bars fuse, or a bar reaching into the entry wall
 * would be left standing across the opening it is supposed to clear.
 */
export function buildSlideLidChannel(
  geometry: SlideLidGeometry,
  plateTopZ: number,
  innerOffsetX: number,
  innerOffsetY: number
): SlideLidChannelSolids {
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

    for (const bar of geometry.bars) put(barSolid(scope, bar), additions);
    for (const detent of geometry.detents) put(detentSolid(scope, detent), additions);
    put(notchSolid(scope, geometry.entryNotch, geometry.clearanceMm), subtractions);
    return null;
  });

  return { additions, subtractions };
}
