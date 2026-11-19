/**
 * Cutter solids for the wall slots: the mirrored boxes every slot is built
 * from, and, over an interior fillet, the channel that carries a slot down the
 * fillet's curve into the floor.
 */

import { box, draw, rotate, translate } from 'brepjs';
import type { DisposalScope, Drawing, Shape3D } from 'brepjs';
import { getDividerLockPlan } from '@/shared/utils/slotMath';
import type { DividerFilletSeat } from '@/shared/utils/slottedFillet';
import { COPLANAR_OVERLAP } from './generatorConstants';

/**
 * Slight extension past the inner wall surface into the (hollow) bin interior.
 * Uses the shared COPLANAR_OVERLAP to avoid coplanar faces between the cutter
 * and the bin's inner wall, which cause OCCT to produce non-manifold topology
 * (slicers then drop one side on repair). The extension cuts into empty space
 * so geometry is unchanged.
 */
export const SLOT_EXTENSION = COPLANAR_OVERLAP;

/**
 * Create a mirrored pair of extruded rectangular cutters along one axis.
 *
 * Produces two boxes at +/- offset along the primary axis, both centered
 * on `crossPos` along the cross axis. The primary-axis dimension is extended
 * by SLOT_EXTENSION; the offset is adjusted so the extension reaches into
 * the bin interior (avoiding coplanar faces).
 *
 * @param primaryDim  Cutter size along the primary axis (before extension)
 * @param crossDim    Cutter size along the cross axis
 * @param height      Extrusion height (Z)
 * @param halfSpan    Half of the interior dimension along the primary axis
 * @param crossPos    Position along the cross axis
 * @param z           Z origin of the extrusion
 * @param axis        'x' places cutters along X (left/right), 'y' along Y (front/back)
 */
export function createMirroredCutters(
  primaryDim: number,
  crossDim: number,
  height: number,
  halfSpan: number,
  crossPos: number,
  z: number,
  axis: 'x' | 'y'
): [Shape3D, Shape3D] {
  const extDim = primaryDim + SLOT_EXTENSION;
  const centerOffset = halfSpan + primaryDim / 2;

  // Rectangle dimensions: axis='x' → (extDim, crossDim), axis='y' → (crossDim, extDim)
  const rectW = axis === 'x' ? extDim : crossDim;
  const rectD = axis === 'x' ? crossDim : extDim;

  // Negative side: outer edge at -halfSpan - primaryDim, extended inward by SLOT_EXTENSION
  const negCenter = -(centerOffset - SLOT_EXTENSION / 2);
  // Positive side: outer edge at +halfSpan + primaryDim, extended inward by SLOT_EXTENSION
  const posCenter = centerOffset - SLOT_EXTENSION / 2;

  const zCenter = z + height / 2;
  const pos = (primary: number): [number, number, number] =>
    axis === 'x' ? [primary, crossPos, zCenter] : [crossPos, primary, zCenter];
  return [
    box(rectW, rectD, height, { at: pos(negCenter) }),
    box(rectW, rectD, height, { at: pos(posCenter) }),
  ];
}

/**
 * How far past the fillet's floor tangent a channel's tall part reaches into
 * the cavity, so no rounding is left standing in the slot.
 */
const CHANNEL_REACH_PAST_FILLET = 0.2;

/** Where one divider line runs and which of its ends seat in a wall. */
export interface DividerLine {
  readonly axis: 'x' | 'y';
  readonly halfSpan: number;
  readonly crossPos: number;
  /** Start and end along the line, from the interior centre. */
  readonly from: number;
  readonly to: number;
  readonly lowWall: boolean;
  readonly highWall: boolean;
}

/** The slot and seat sizes every line of one bin shares. */
export interface FilletSlotSizes {
  readonly fillet: DividerFilletSeat;
  readonly slotDepth: number;
  readonly slotWidth: number;
  readonly thickness: number;
  readonly clearance: number;
  /** Height of a wall slot above the seat. */
  readonly slotHeight: number;
  readonly seatZ: number;
  readonly floorTop: number;
}

/**
 * The section of one divider line's cutter, `u` along the line from its low
 * end, in the body frame's Z. At a wall end it runs down the slot's floor,
 * round an arc tangent to it and to the seat, and stands full height just past
 * the fillet, so the channel follows the fillet's curve and leaves the corner
 * behind it solid. With a floor groove the whole line is one section, so the
 * groove and both channels are one face each, with no seam where they meet.
 * Without one, only the stretch over the fillet is cut.
 */
function lineSection(
  sizes: FilletSlotSizes,
  length: number,
  lowWall: boolean,
  highWall: boolean,
  headTop: number
): Drawing {
  const { fillet, slotDepth: sd, seatZ, floorTop } = sizes;
  const r = fillet.channelRadius;
  const cu = r - sd;
  const cz = seatZ + r;
  const top = Math.max(headTop, cz);
  const lip = floorTop + COPLANAR_OVERLAP;
  const reach = fillet.filletRadius + CHANNEL_REACH_PAST_FILLET;
  const half = Math.SQRT1_2 * r;
  let pen = lowWall
    ? draw([-sd, top])
        .lineTo([-sd, cz])
        .threePointsArcTo([cu, seatZ], [cu - half, cz - half])
    : draw([0, lip]).lineTo([0, seatZ]);
  pen = highWall
    ? pen
        .lineTo([length - cu, seatZ])
        .threePointsArcTo([length + sd, cz], [length - cu + half, cz - half])
        .lineTo([length + sd, top])
    : pen.lineTo([length, seatZ]).lineTo([length, lip]);
  const hi = highWall ? length - reach : length;
  const lo = lowWall ? reach : 0;
  if (hi - lo > 0.5) {
    if (highWall) pen = pen.lineTo([hi, top]).lineTo([hi, lip]);
    if (lowWall) pen = pen.lineTo([lo, lip]).lineTo([lo, top]);
  } else {
    if (!highWall) pen = pen.lineTo([length, top]);
    if (!lowWall) pen = pen.lineTo([0, top]);
  }
  return pen.close();
}

/** One wall end's channel over the fillet, for a line with no floor groove. */
function endSection(sizes: FilletSlotSizes, headTop: number): Drawing {
  const { fillet, slotDepth: sd, seatZ } = sizes;
  const r = fillet.channelRadius;
  const cu = r - sd;
  const cz = seatZ + r;
  const top = Math.max(headTop, cz);
  const reach = fillet.filletRadius + CHANNEL_REACH_PAST_FILLET;
  const half = Math.SQRT1_2 * r;
  return draw([-sd, top])
    .lineTo([-sd, cz])
    .threePointsArcTo([cu, seatZ], [cu - half, cz - half])
    .lineTo([reach, seatZ])
    .lineTo([reach, top])
    .close();
}

/**
 * Stand a section up along a divider line: `YZ` takes the drawing's u to
 * world Y and its z to Z, the extrusion runs across the slot's width, and a
 * line along X is turned onto its axis.
 */
function placeSection(
  scope: DisposalScope,
  section: Drawing,
  slotWidth: number,
  axis: 'x' | 'y',
  turn: number,
  at: [number, number]
): Shape3D {
  const upright = scope.register(section.sketchOnPlane('YZ', -slotWidth / 2).extrude(slotWidth));
  const angle = (axis === 'x' ? -90 : 0) + turn;
  const turned =
    angle === 0 ? upright : scope.register(rotate(upright, angle, { axis: [0, 0, 1] }));
  return translate(turned, [at[0], at[1], 0]);
}

/**
 * Every cutter for one divider line over an interior fillet: the channel down
 * the fillet's curve at each wall end, with the floor groove between, and the
 * lock lifted clear of the curve, where the tab is straight.
 */
export function filletLineCutters(
  scope: DisposalScope,
  sizes: FilletSlotSizes,
  line: DividerLine,
  grooveDepth: number
): Shape3D[] {
  const { fillet, slotDepth, slotWidth, slotHeight, seatZ } = sizes;
  const lock = getDividerLockPlan(sizes.thickness, sizes.clearance);
  const headTop = fillet.lockLift + lock.headHeight;
  const lockFits = slotHeight > headTop + lock.throatHeight;
  const channelTop = seatZ + (lockFits ? headTop : slotHeight);
  const along = (u: number): [number, number] =>
    line.axis === 'x' ? [u, line.crossPos] : [line.crossPos, u];

  const cutters: Shape3D[] = [];
  if (grooveDepth > 0) {
    const section = lineSection(
      sizes,
      line.to - line.from,
      line.lowWall,
      line.highWall,
      channelTop
    );
    cutters.push(placeSection(scope, section, slotWidth, line.axis, 0, along(line.from)));
  } else {
    const section = endSection(sizes, channelTop);
    if (line.lowWall) {
      cutters.push(placeSection(scope, section, slotWidth, line.axis, 0, along(-line.halfSpan)));
    }
    if (line.highWall) {
      cutters.push(placeSection(scope, section, slotWidth, line.axis, 180, along(line.halfSpan)));
    }
  }

  if (!lockFits) return cutters;
  for (const [width, segmentHeight, segmentZ] of [
    [lock.throatWidth, lock.throatHeight, seatZ + headTop],
    [slotWidth, slotHeight - headTop - lock.throatHeight, seatZ + headTop + lock.throatHeight],
  ] as const) {
    const [low, high] = createMirroredCutters(
      slotDepth,
      width,
      segmentHeight,
      line.halfSpan,
      line.crossPos,
      segmentZ,
      line.axis
    );
    for (const [keep, cutter] of [
      [line.lowWall, low],
      [line.highWall, high],
    ] as const) {
      if (keep) cutters.push(cutter);
      else cutter.delete();
    }
  }
  return cutters;
}
