/**
 * Side-profile outlines for the knives a knife block's slots were sized for,
 * in the block's own build frame (XY centred on the interior, Z=0 the print
 * bottom).
 *
 * The pose is the physical model `knifeBlock.ts` describes rather than a
 * drawing decision: the spine lies flush with the block's fill top, the blade
 * hangs in its slot, and the handle leaves through the slot's open end with
 * its underside on the saddle line the rest's groove is carved to. Anything
 * here that restated one of those heights would be a second copy of the
 * arithmetic the rest is built from, so each comes from the shared helper.
 */

import type { BinParams, KnifeSpec } from '@/features/bin-designer/types';
import {
  DEFAULT_KNIFE_SPEC,
  knifeBlockTopZMm,
  knifeRestSaddleZMm,
} from '@/features/bin-designer/types';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import { labelTabInteriorDims } from '@/shared/utils/labelTabPlan';

/**
 * Drawn handle length (mm). A silhouette length, not a measurement: the spec
 * carries no handle length, and this clears the widest default gap so the
 * handle visibly reaches over the rest.
 */
export const GHOST_HANDLE_LENGTH_MM = 110;

/** Segments approximating the handle's rounded butt. */
const BUTT_SEGMENTS = 8;

/**
 * Silhouette proportions of the blade, as fractions of its length and heel
 * height. Purely how the outline is drawn — the spine, the heel and the tip
 * position are the only points the slot's own dimensions fix.
 */
const BLADE_SPINE_RUN = 0.72;
const BLADE_TIP_DROP = 0.28;
const BLADE_BELLY_ALONG = 0.5;
const BLADE_BELLY_DROP = 0.86;

/**
 * Direction the slot's local +X points after a rotation of `index * 90°`.
 * Same step order `knifeExitSide` names its walls in (right, front, left,
 * back), so the two answer the same question the same way.
 */
const AXIS_BY_STEP: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, -1],
  [-1, 0],
  [0, 1],
];

/**
 * One outline vertex: distance along the knife from the heel toward the
 * handle's butt, and height relative to the spine (never positive).
 */
export type KnifeProfilePoint = readonly [along: number, belowSpine: number];

export interface KnifeGhostProfile {
  /** Closed blade outline, entirely at or behind the heel. */
  readonly blade: readonly KnifeProfilePoint[];
  /** Closed handle outline, entirely at or past the heel. */
  readonly handle: readonly KnifeProfilePoint[];
}

/** Where one knife lies, in the block's centred build frame. */
export interface KnifeGhostPose {
  /** Blade/handle junction: the slot's open-end edge. */
  readonly heelX: number;
  readonly heelY: number;
  /** Unit vector from the heel toward the handle's butt. */
  readonly outX: number;
  readonly outY: number;
  /** The block's fill top, which the spine lies flush with. */
  readonly spineZ: number;
  readonly knife: KnifeSpec;
}

/**
 * The knife's outline in its own frame: `[0, 0]` is the heel at the spine,
 * negative `along` runs into the block, positive out past the open end.
 */
export function knifeGhostProfile(knife: KnifeSpec): KnifeGhostProfile {
  const length = knife.bladeLengthMm;
  const heel = knife.heelHeightMm;
  const blade: KnifeProfilePoint[] = [
    [0, 0],
    [-BLADE_SPINE_RUN * length, 0],
    [-length, -BLADE_TIP_DROP * heel],
    [-BLADE_BELLY_ALONG * length, -BLADE_BELLY_DROP * heel],
    [0, -heel],
  ];

  // The underside IS the saddle line the rest's groove bottoms out on, taken
  // from the same helper the groove is cut with — measured from the spine, so
  // the block top it is relative to is 0 here. This is the side profile, so the
  // handle's vertical extent is its height.
  const bottom = knifeRestSaddleZMm(0, knife);
  const top = bottom + knife.handleHeightMm;
  const radius = knife.handleHeightMm / 2;
  const buttStart = Math.max(0, GHOST_HANDLE_LENGTH_MM - radius);
  const handle: KnifeProfilePoint[] = [
    [0, top],
    [buttStart, top],
  ];
  for (let i = 1; i < BUTT_SEGMENTS; i++) {
    const angle = (i / BUTT_SEGMENTS) * Math.PI;
    handle.push([buttStart + radius * Math.sin(angle), top - radius + radius * Math.cos(angle)]);
  }
  handle.push([buttStart, bottom], [0, bottom]);

  return { blade, handle };
}

/**
 * Every knife the design's open-ended slots hold, posed in the block's frame.
 *
 * Gated exactly as `knifeSlotWallExits` gates the wall breach it is the other
 * half of — solid host, ungrouped, unhidden, axis-aligned, an open end on the
 * spec — because a ghost for a knife the block does not let out is a knife
 * lying through a wall. Slots exiting a wall the rest does not serve are still
 * posed: they hold a knife the same way, with nothing under the handle, which
 * is what the design actually does.
 */
export function knifeGhostPoses(params: BinParams): readonly KnifeGhostPose[] {
  if (!params.base.solid) return [];
  // The same interior the exits are measured against, so a ghost and the
  // groove its handle lands in share one origin.
  const dims = labelTabInteriorDims(params);
  if (!dims) return [];
  const spineZ = knifeBlockTopZMm(params);

  const poses: KnifeGhostPose[] = [];
  for (const master of params.cutouts) {
    if (master.shape !== 'knifeSlot' || master.groupId !== null || master.hidden === true) {
      continue;
    }
    const knife = master.knife ?? DEFAULT_KNIFE_SPEC;
    const openEnd = knife.openEnd;
    if (openEnd === undefined) continue;
    for (const inst of master.array ? expandCutoutArray(master) : [master]) {
      if (inst.rotation % 90 !== 0) continue;
      const steps = ((Math.round(inst.rotation / 90) % 4) + 4) % 4;
      const axis = AXIS_BY_STEP[steps];
      const sign = openEnd === 'end' ? 1 : -1;
      const outX = axis[0] * sign;
      const outY = axis[1] * sign;
      const centreX = inst.x + inst.width / 2 - dims.innerW / 2;
      const centreY = inst.y + inst.depth / 2 - dims.innerD / 2;
      poses.push({
        heelX: centreX + (outX * inst.width) / 2,
        heelY: centreY + (outY * inst.width) / 2,
        outX,
        outY,
        spineZ,
        knife,
      });
    }
  }
  return poses;
}

/**
 * Flat `LineSegmentsGeometry` positions for every posed knife: each closed
 * outline emitted as its own segments.
 */
export function buildKnifeGhostPositions(params: BinParams): number[] {
  const positions: number[] = [];
  for (const pose of knifeGhostPoses(params)) {
    const { blade, handle } = knifeGhostProfile(pose.knife);
    for (const loop of [blade, handle]) {
      for (let i = 0; i < loop.length; i++) {
        const [along1, below1] = loop[i];
        const [along2, below2] = loop[(i + 1) % loop.length];
        positions.push(
          pose.heelX + pose.outX * along1,
          pose.heelY + pose.outY * along1,
          pose.spineZ + below1,
          pose.heelX + pose.outX * along2,
          pose.heelY + pose.outY * along2,
          pose.spineZ + below2
        );
      }
    }
  }
  return positions;
}
