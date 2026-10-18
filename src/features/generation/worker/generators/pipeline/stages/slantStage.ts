/**
 * Slant stage: leans everything above the floor toward one side.
 *
 * A shear pivoting on the floor's underside (`baseOffsetZ` once the translate
 * stage has lifted the body), so that plane does not move and the socket,
 * still upright in `deferredSolid`, meets the body exactly where it did. Runs
 * after every other solid stage so each feature is built in the upright frame
 * and simply comes along.
 *
 * Needs occt-wasm 5.6.1+: earlier kernels applied a face's location to its
 * cached mesh a second time, floating a pre-meshed top to about twice its
 * height while the exact volume stayed right.
 */

import { applyMatrix, getFaceOrigins, getFaces, getHashCode, setShapeOrigin, unwrap } from 'brepjs';
import type { MatrixTransform, Shape3D } from 'brepjs';
import { resolveSlant } from '@/shared/utils/slantPlan';
import type { SlantPlan } from '@/shared/utils/slantPlan';
import type { PipelineContext, PipelineStage } from '../types';
import { checkCancelled } from '../../utils/abort';

export function slantMatrix(plan: SlantPlan, pivotZ: number): MatrixTransform {
  const k = plan.k * plan.sign;
  return plan.axis === 'x'
    ? { linear: [1, 0, k, 0, 1, 0, 0, 0, 1], translation: [-k * pivotZ, 0, 0] }
    : { linear: [1, 0, 0, 0, 1, k, 0, 0, 1], translation: [0, -k * pivotZ, 0] };
}

/**
 * brepjs carries face origins through a non-orthogonal transform by face hash
 * only, and the transform rebuilds every face, so the feature colours would
 * all collapse to origin 0. The transform keeps the topology, so faces pair up
 * in iteration order.
 */
function copyOriginsByOrder(source: Shape3D, target: Shape3D): void {
  const origins = getFaceOrigins(source);
  if (!origins) return;
  const before = getFaces(source);
  const after = getFaces(target);
  if (before.length !== after.length) return;
  setShapeOrigin(target, 0);
  const own = getFaceOrigins(target);
  if (!own) return;
  for (let i = 0; i < before.length; i++) {
    const origin = origins.get(getHashCode(before[i]));
    if (origin !== undefined) own.set(getHashCode(after[i]), origin);
  }
}

export const slantStage: PipelineStage = {
  name: 'merge',
  progressValue: 0.88,

  shouldRun(ctx: PipelineContext): boolean {
    return ctx.solid !== null && resolveSlant(ctx.params) !== null;
  },

  execute(ctx: PipelineContext): PipelineContext {
    const plan = resolveSlant(ctx.params);
    if (!ctx.solid || !plan) return ctx;
    checkCancelled(ctx.signal);

    const solid = ctx.solid;
    const sheared = unwrap(applyMatrix(solid, slantMatrix(plan, ctx.dimensions.baseOffsetZ)));
    copyOriginsByOrder(solid, sheared);
    solid.delete();
    return { ...ctx, solid: sheared };
  },
};
