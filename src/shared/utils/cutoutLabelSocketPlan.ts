/**
 * Socket placement planning for a shadow board's swappable-label plates.
 *
 * Pure fit math shared by the generation worker (which cuts the pockets), the
 * cutout editor (footprint overlay, width picker, warnings) and the plate
 * export, so the four can never disagree about which plate a cutout gets.
 *
 * Unlike a compartment (an enforced rectangle whose tab span is closed-form),
 * a cutout sits in free space beside arbitrary neighbours. A pocket is 2.2mm
 * of solid material deep, so a footprint straying over a neighbouring cavity
 * loses its floor and interrupts the rib run: the plate no longer clicks in.
 * Neither failure changes the mesh's bounding box, triangle count or
 * watertightness, so the clear-space test has to happen HERE, before anything
 * is cut, rather than as an assertion on the result.
 */

import type { BinParams, Cutout, CutoutTextAnchor } from '@/shared/types/bin';
import {
  cutoutWorldAabb,
  labelPlacementForAabb,
  resolveCutoutTextAnchor,
  unionAabb,
} from '@/shared/utils/cutoutLabel';
import type { CutoutAabb } from '@/shared/utils/cutoutLabel';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import {
  isLabelPlateIconId,
  isLabelPlateWidthU,
  labelSocketOuterDepthMm,
  labelSocketOuterWidthMm,
  LABEL_PLATE_WIDTHS_U,
  LABEL_SOCKET_CLICK_POCKET_DEPTH_MM,
  LABEL_SOCKET_FLOOR_MM,
  cutoutSocketSinkMm,
  effectiveLabelSocketClearance,
} from '@/shared/constants/labelPlates';
import type { LabelPlateIconId, LabelPlateWidthU } from '@/shared/constants/labelPlates';

/**
 * Ceiling on sockets cut into one board. Each socket is a boolean against the
 * body, so an unbounded count stalls the editing loop on a board that has one
 * per cutout. Skipped sockets are reported rather than dropped silently.
 */
export const MAX_CUTOUT_LABEL_SOCKETS = 32;

/** Why a socket-mode cutout ended up without a socket. */
export type CutoutSocketSkipReason =
  /** The `center` anchor sits over the cutout's own cavity, so nothing to cut into. */
  | 'centerAnchor'
  /** No standard width fits the gap without straying outside it. */
  | 'noRoom'
  /** Too little material under the surface to hold a pocket and its floor. */
  | 'tooShallow'
  /** Past {@link MAX_CUTOUT_LABEL_SOCKETS}. */
  | 'capped';

export interface CutoutSocketPlacement {
  readonly cutoutId: string;
  /** Pocket center in the frame the caller's origin args describe. */
  readonly centerX: number;
  readonly centerY: number;
  readonly widthU: LabelPlateWidthU;
  /** True when the plate runs along Y (a 90° socket). */
  readonly vertical: boolean;
  /** Standard widths that fit here: what the width picker may offer. */
  readonly fittingWidthsU: readonly LabelPlateWidthU[];
  readonly text: string;
  readonly icon?: LabelPlateIconId;
}

export interface CutoutSocketSkip {
  readonly cutoutId: string;
  readonly reason: CutoutSocketSkipReason;
}

export interface CutoutSocketPlan {
  readonly sockets: readonly CutoutSocketPlacement[];
  readonly skipped: readonly CutoutSocketSkip[];
}

export interface CutoutSocketPlanInput {
  readonly cutouts: readonly Cutout[];
  /** Bin interior width/depth (mm). */
  readonly innerW: number;
  readonly innerD: number;
  /** Interior-frame origin: 0 in the 2D editor, `-innerW/2` in generation. */
  readonly originX?: number;
  readonly originY?: number;
  /** Total pocket clearance, nozzle-scaled and fit-offset adjusted. */
  readonly clearanceMm: number;
  /**
   * Solid fill surface height above the floor (`wallHeight - topOffset`), less
   * any stacking sink. A pocket needs its depth plus a floor beneath it.
   */
  readonly surfaceZ: number;
}

const EMPTY_PLAN: CutoutSocketPlan = { sockets: [], skipped: [] };

/** A cutout whose label is a swappable plate rather than an engraving. */
export function isCutoutSocketMode(cutout: Pick<Cutout, 'labelMode' | 'shape'>): boolean {
  // A text element's caption is the element itself — there is no adjacent
  // board to pocket a plate into, so a stray labelMode on one is ignored.
  return cutout.labelMode === 'socket' && cutout.shape !== 'text';
}

/**
 * Whether a cutout's label is engraved into the board. Socket mode moves the
 * caption onto the plate, so the two are mutually exclusive.
 */
export function isCutoutEngraveMode(
  cutout: Pick<Cutout, 'labelMode' | 'engraveLabel' | 'shape'>
): boolean {
  return cutout.engraveLabel === true && !isCutoutSocketMode(cutout);
}

/**
 * Socket orientation from the cutout's label angle.
 *
 * A plate has no head and no tail, so only its AXIS matters: 180 is the same
 * run as 0, and 270 the same run as 90. The angle is therefore folded onto a
 * half turn and bucketed to the nearer axis, which also gives a sensible answer
 * for an angle the socket UI never writes: the field is shared with the
 * engraved label, whose control accepts any whole degree, so a cutout switched
 * from engrave to socket can arrive carrying one.
 */
export function isCutoutSocketVertical(cutout: Pick<Cutout, 'textAngle'>): boolean {
  const halfTurn = (((cutout.textAngle ?? 0) % 180) + 180) % 180;
  return halfTurn >= 45 && halfTurn < 135;
}

/**
 * Whether this design's body is the solid slab a board socket is cut into.
 *
 * Mirrors `deriveDimensions`' own `solid`, gate for gate: `featuresStage` cuts
 * cutouts (and these sockets) only on that branch, so a plan that answered for
 * a hollow bin would have the panel, the preview and the plate export all
 * describing pockets nothing ever cuts. `base.solid` is forced false for any
 * style but `'solid'`, so reading it is not the same as reading the style.
 */
function hasSolidBody(params: BinParams): boolean {
  return params.base.solid || params.base.tile === true;
}

/**
 * The footprint a cutout's label anchors against: its own box, or the full
 * extent of every instance when it drives an array.
 *
 * Deliberately array-aware where the engraved label is not. An engraving is
 * 0.4mm of glyph and lands harmlessly over a sibling hole; a pocket anchored
 * to instance 0 of a 3x4 grid would be planned into a gap that eleven other
 * holes are sitting in.
 */
export function cutoutSocketAnchorAabb(
  cutout: Cutout,
  originX: number,
  originY: number
): CutoutAabb {
  const instances = expandCutoutArray(cutout);
  let box = cutoutWorldAabb(instances[0], originX, originY);
  for (let i = 1; i < instances.length; i++) {
    box = unionAabb(box, cutoutWorldAabb(instances[i], originX, originY));
  }
  return box;
}

/** Outer socket footprint for a width, accounting for a 90° socket. */
function socketFootprint(
  widthU: LabelPlateWidthU,
  clearanceMm: number,
  vertical: boolean
): { w: number; d: number } {
  const along = labelSocketOuterWidthMm(widthU, clearanceMm);
  const across = labelSocketOuterDepthMm(clearanceMm);
  return vertical ? { w: across, d: along } : { w: along, d: across };
}

function overlaps(a: CutoutAabb, b: CutoutAabb): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
}

/**
 * Every cavity on the board, in the interior frame. Arrays are expanded:
 * a master's box describes one hole out of N. Hidden cutouts are absent from
 * the build, so they obstruct nothing.
 */
function obstructionBoxes(
  cutouts: readonly Cutout[],
  originX: number,
  originY: number
): CutoutAabb[] {
  const boxes: CutoutAabb[] = [];
  for (const cutout of cutouts) {
    if (cutout.hidden === true) continue;
    for (const instance of expandCutoutArray(cutout)) {
      boxes.push(cutoutWorldAabb(instance, originX, originY));
    }
  }
  return boxes;
}

/**
 * Resolve every swappable-label socket a board's cutouts ask for.
 *
 * The anchor fixes the center; only the plate WIDTH gives way to a neighbour.
 * Sliding a socket clear would put it somewhere the user did not place it and
 * leave the offset fields describing a position it no longer holds.
 */
export function planCutoutLabelSockets(input: CutoutSocketPlanInput): CutoutSocketPlan {
  const { cutouts, innerW, innerD, clearanceMm, surfaceZ } = input;
  const originX = input.originX ?? 0;
  const originY = input.originY ?? 0;
  if (cutouts.length === 0) return EMPTY_PLAN;

  const candidates = cutouts.filter((c) => c.hidden !== true && isCutoutSocketMode(c));
  if (candidates.length === 0) return EMPTY_PLAN;

  const sockets: CutoutSocketPlacement[] = [];
  const skipped: CutoutSocketSkip[] = [];

  // A pocket hangs from the surface and needs a solid floor under it.
  if (surfaceZ < LABEL_SOCKET_CLICK_POCKET_DEPTH_MM + LABEL_SOCKET_FLOOR_MM) {
    return {
      sockets,
      skipped: candidates.map((c) => ({ cutoutId: c.id, reason: 'tooShallow' as const })),
    };
  }

  // Seeded with the cavities, then GROWN with each pocket as it is accepted:
  // two neighbouring cutouts anchored into the same gap would otherwise both
  // centre a plate there and merge into one cavity, destroying both rib runs.
  // Order-dependent by design: earlier cutouts hold their width, later ones
  // narrow or stand down, which is stable for a given design.
  const boxes = obstructionBoxes(cutouts, originX, originY);
  const interior: CutoutAabb = {
    minX: originX,
    maxX: originX + innerW,
    minY: originY,
    maxY: originY + innerD,
  };

  for (const cutout of candidates) {
    if (sockets.length >= MAX_CUTOUT_LABEL_SOCKETS) {
      skipped.push({ cutoutId: cutout.id, reason: 'capped' });
      continue;
    }

    const anchor: CutoutTextAnchor = resolveCutoutTextAnchor(cutout);
    if (anchor === 'center') {
      skipped.push({ cutoutId: cutout.id, reason: 'centerAnchor' });
      continue;
    }

    const placement = labelPlacementForAabb(
      cutoutSocketAnchorAabb(cutout, originX, originY),
      anchor,
      cutout.textOffset,
      innerW,
      innerD,
      originX,
      originY
    );
    if (!placement) {
      skipped.push({ cutoutId: cutout.id, reason: 'noRoom' });
      continue;
    }

    const vertical = isCutoutSocketVertical(cutout);
    const { centerX, centerY } = placement;

    const rectFor = (u: LabelPlateWidthU): CutoutAabb => {
      const { w, d } = socketFootprint(u, clearanceMm, vertical);
      return {
        minX: centerX - w / 2,
        maxX: centerX + w / 2,
        minY: centerY - d / 2,
        maxY: centerY + d / 2,
      };
    };

    const fittingWidthsU = LABEL_PLATE_WIDTHS_U.filter((u) => {
      const rect = rectFor(u);
      if (
        rect.minX < interior.minX ||
        rect.maxX > interior.maxX ||
        rect.minY < interior.minY ||
        rect.maxY > interior.maxY
      ) {
        return false;
      }
      return !boxes.some((box) => overlaps(rect, box));
    });

    const autoWidthU = fittingWidthsU.at(-1);
    if (autoWidthU === undefined) {
      skipped.push({ cutoutId: cutout.id, reason: 'noRoom' });
      continue;
    }

    const override = cutout.labelPlateWidthU;
    const widthU =
      isLabelPlateWidthU(override) && fittingWidthsU.includes(override) ? override : autoWidthU;
    const icon = cutout.labelIcon;
    boxes.push(rectFor(widthU));

    sockets.push({
      cutoutId: cutout.id,
      centerX,
      centerY,
      widthU,
      vertical,
      fittingWidthsU,
      text: cutout.label.trim(),
      ...(isLabelPlateIconId(icon) ? { icon } : {}),
    });
  }

  return { sockets, skipped };
}

/**
 * The socket plan for a design, deriving the pocket plane and clearance the
 * builder will actually use.
 *
 * Single source for both: the worker cuts against what this returns, and the
 * UI, the plate export and the print list all read the same call. Deriving the
 * surface or the clearance a second time anywhere is how a plate ends up
 * planned for a pocket that was never cut.
 */
export function planCutoutSocketsForParams(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeightMm: number
): CutoutSocketPlan {
  // Stored designs reach this through `migrateParams`, which fills `cutouts`
  // and `cutoutConfig` from the defaults, so both are read plainly.
  const cutouts = params.cutouts;
  if (cutouts.length === 0 || !hasSolidBody(params)) return EMPTY_PLAN;
  // A fill surface too shallow to hold a pocket is reported rather than
  // returned empty: the cutouts asked for sockets and did not get them, which
  // is exactly what the panel exists to say.
  return planCutoutLabelSockets({
    cutouts,
    innerW,
    innerD,
    originX: -innerW / 2,
    originY: -innerD / 2,
    clearanceMm: effectiveLabelSocketClearance(params.nozzleSizeMm, params.label.plateFitOffset),
    surfaceZ: cutoutSocketTopZ(params, wallHeightMm),
  });
}

/** Pocket top plane above the bin floor: the fill surface, less any sink. */
export function cutoutSocketTopZ(params: BinParams, wallHeightMm: number): number {
  const topOffset = params.cutoutConfig.topOffset;
  return wallHeightMm - topOffset - cutoutSocketSinkMm(params.base.stackingLip, topOffset);
}
