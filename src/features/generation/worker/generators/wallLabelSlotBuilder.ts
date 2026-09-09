/**
 * Vertical label slots in the outer walls.
 *
 * Each slot is three solids on one wall: a boss fused to the wall's inner
 * face that gives the joint its back and its ends where the wall alone is
 * too thin, a slot cut behind the outer face that a Cullenect 1u plate drops
 * into from the top, and a window cut through the frame in front of it so the
 * plate can be read. The boss goes in on the fuse pass and both cuts on the
 * cut pass, so the slot is clean whatever else the wall carries.
 *
 * Authored on a canonical wall (inner face on Y=0, cavity toward +Y, wall
 * running along X) and turned onto each side the way scoop ramps are, so all
 * four walls share one set of numbers from `planWallLabelSlots`.
 */

import { box, clone, draw, fuseAll, rotate, translate, unwrap, withScope } from 'brepjs';
import type { DisposalScope, Shape3D, ValidSolid } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { effectiveLabelSocketClearance } from '@/shared/constants/labelPlates';
import {
  WALL_LABEL_SLOT_BOTTOM_BAR_MM,
  planWallLabelSlotCorners,
  planWallLabelSlots,
  resolveWallLabelSlots,
  type WallLabelSlotPlan,
  type WallLabelSlotSide,
} from '@/shared/utils/wallLabelSlotPlan';
import type { FeatureBuilder } from './pipeline/featureBuilder';
import type { BinDimensions } from './pipeline/types';
import { FeatureTag } from './featureTags';
import { buildCacheKey, compactKey, quantize, stableSerialize } from './cacheKeyUtils';
import { LIP_HEIGHT } from './generatorConstants';
import { sketch } from './meshUtils';

/** Growth (mm) of a boss into the wall it welds to. */
const FUSE_OVERLAP_MM = 0.2;
/** Cutters run past the faces they open so no boolean lands on a coplanar face. */
const OVERSHOOT_MM = 1;

const ROTATION_DEG: Record<WallLabelSlotSide, number> = {
  front: 0,
  back: 180,
  left: -90,
  right: 90,
};

/** Rim the slot opens through: the wall plus any collar. */
function rimZ(dim: BinDimensions): number {
  return dim.wallHeight + dim.collarHeight;
}

export function planForContext(params: BinParams, dim: BinDimensions): WallLabelSlotPlan {
  return planWallLabelSlots(
    params,
    { wallHeightMm: rimZ(dim), gridUnitMmX: dim.gridUnitMmX, gridUnitMmY: dim.gridUnitMmY },
    effectiveLabelSocketClearance(params.nozzleSizeMm, params.label.plateFitOffset)
  );
}

/** A canonical solid onto its wall: rotate about Z, then move to the inner face. */
function placeOnWall(
  scope: DisposalScope,
  shape: Shape3D,
  side: WallLabelSlotSide,
  innerW: number,
  innerD: number
): Shape3D {
  const deg = ROTATION_DEG[side];
  const oriented = deg === 0 ? shape : scope.register(rotate(shape, deg, { axis: [0, 0, 1] }));
  const at: [number, number, number] =
    side === 'front'
      ? [0, -innerD / 2, 0]
      : side === 'back'
        ? [0, innerD / 2, 0]
        : side === 'left'
          ? [-innerW / 2, 0, 0]
          : [innerW / 2, 0, 0];
  return scope.register(translate(oriented, at));
}

/**
 * The plan's along-wall offset in the canonical frame. A rotation of 180° or
 * -90° flips the canonical X axis against the bin axis it lands on.
 */
function canonicalOffset(side: WallLabelSlotSide, offset: number): number {
  return side === 'back' || side === 'left' ? -offset : offset;
}

function buildBosses(
  scope: DisposalScope,
  plan: WallLabelSlotPlan,
  innerW: number,
  innerD: number
): Shape3D | null {
  if (plan.bossDepthMm <= 0 || plan.slots.length === 0) return null;
  const depth = plan.bossDepthMm;
  const bottom = plan.bossBottomZ;
  const top = plan.wallTopZ;
  // Section across the wall (u -> Y inward from the inner face, v -> Z). The
  // underside climbs at 45° from the wall so it prints without support.
  const profile = draw([-FUSE_OVERLAP_MM, bottom])
    .lineTo([0, bottom])
    .lineTo([depth, bottom + depth])
    .lineTo([depth, top])
    .lineTo([-FUSE_OVERLAP_MM, top])
    .close();
  const bosses: Shape3D[] = [];
  for (const slot of plan.slots) {
    const bar = scope.register(
      sketch(profile, 'YZ', -plan.bossWidthMm / 2).extrude(plan.bossWidthMm)
    );
    const along = scope.register(translate(bar, [canonicalOffset(slot.side, slot.offset), 0, 0]));
    bosses.push(placeOnWall(scope, along, slot.side, innerW, innerD));
  }
  return bosses.length === 1 ? bosses[0] : scope.register(unwrap(fuseAll(bosses as ValidSolid[])));
}

function buildCuts(
  scope: DisposalScope,
  plan: WallLabelSlotPlan,
  params: BinParams,
  dim: BinDimensions
): Shape3D | null {
  if (plan.slots.length === 0) return null;
  const { innerW, innerD, hasLip } = dim;
  const wallThickness = params.wallThickness;
  const outerY = -wallThickness;
  const top = plan.wallTopZ + (hasLip ? LIP_HEIGHT : 0) + OVERSHOOT_MM;
  const slotY0 = outerY + plan.frameMm;
  const slotH = top - plan.floorZ;
  const windowY0 = outerY - OVERSHOOT_MM;
  const windowDepth = plan.frameMm + OVERSHOOT_MM + 0.02;
  const windowZ0 = plan.floorZ + WALL_LABEL_SLOT_BOTTOM_BAR_MM;
  const windowH = top - windowZ0;
  const cutters: Shape3D[] = [];
  for (const slot of plan.slots) {
    const x = canonicalOffset(slot.side, slot.offset);
    const slotBox = scope.register(
      box(plan.socketWidthMm, plan.slotThicknessMm, slotH, {
        at: [x, slotY0 + plan.slotThicknessMm / 2, plan.floorZ + slotH / 2],
      })
    );
    const windowBox = scope.register(
      box(plan.windowWidthMm, windowDepth, windowH, {
        at: [x, windowY0 + windowDepth / 2, windowZ0 + windowH / 2],
      })
    );
    const socket = scope.register(unwrap(fuseAll([slotBox, windowBox] as ValidSolid[])));
    cutters.push(placeOnWall(scope, socket, slot.side, innerW, innerD));
  }
  const corners = planWallLabelSlotCorners(
    plan,
    params,
    { gridUnitMmX: dim.gridUnitMmX, gridUnitMmY: dim.gridUnitMmY },
    { innerW, innerD }
  );
  for (const corner of corners) {
    const w = corner.x[1] - corner.x[0];
    const d = corner.y[1] - corner.y[0];
    cutters.push(
      scope.register(
        box(w, d, slotH, {
          at: [corner.x[0] + w / 2, corner.y[0] + d / 2, plan.floorZ + slotH / 2],
        })
      )
    );
  }
  return cutters.length === 1
    ? cutters[0]
    : scope.register(unwrap(fuseAll(cutters as ValidSolid[])));
}

function slotsKey(ctx: { params: BinParams; dimensions: BinDimensions }, tag: string): string {
  const { params, dimensions: dim } = ctx;
  return compactKey(
    buildCacheKey(
      tag,
      dim.shellKey,
      stableSerialize(resolveWallLabelSlots(params)),
      quantize(params.wallThickness),
      quantize(rimZ(dim)),
      quantize(dim.innerW),
      quantize(dim.innerD),
      quantize(dim.gridUnitMmX),
      quantize(dim.gridUnitMmY),
      params.width,
      params.depth,
      quantize(effectiveLabelSocketClearance(params.nozzleSizeMm, params.label.plateFitOffset)),
      dim.hasLip
    )
  );
}

const shouldBuildSlots = (ctx: { params: BinParams }): boolean =>
  resolveWallLabelSlots(ctx.params).enabled;

export const wallLabelSlotBossesFeature: FeatureBuilder = {
  name: 'wallLabelSlotBosses',
  tag: FeatureTag.LABEL_TAB,
  target: 'fuse',
  shouldBuild: shouldBuildSlots,
  cacheKey: (ctx) => slotsKey(ctx, 'wls-boss-v1'),
  build: (ctx) => {
    const plan = planForContext(ctx.params, ctx.dimensions);
    const result = withScope((scope: DisposalScope) => {
      const fused = buildBosses(scope, plan, ctx.dimensions.innerW, ctx.dimensions.innerD);
      return fused ? unwrap(clone(fused)) : null;
    });
    return result ? [result] : null;
  },
};

export const wallLabelSlotCutsFeature: FeatureBuilder = {
  name: 'wallLabelSlotCuts',
  tag: FeatureTag.LABEL_TAB,
  target: 'cut',
  shouldBuild: shouldBuildSlots,
  cacheKey: (ctx) => slotsKey(ctx, 'wls-cut-v1'),
  build: (ctx) => {
    const plan = planForContext(ctx.params, ctx.dimensions);
    const result = withScope((scope: DisposalScope) => {
      const fused = buildCuts(scope, plan, ctx.params, ctx.dimensions);
      return fused ? unwrap(clone(fused)) : null;
    });
    return result ? [result] : null;
  },
};
