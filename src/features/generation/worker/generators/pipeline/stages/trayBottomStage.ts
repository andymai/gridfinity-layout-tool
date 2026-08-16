/**
 * Tray-bottom stage — fuses a lid's mating skirt under the bin.
 *
 * The bin body and the lid share an outer profile exactly, which is what lets
 * this compose the lid builders instead of duplicating them: the body is
 * `width * gridUnit - CLEARANCE` (0.5mm) and the lid is
 * `width * gridUnit - 2 * LID_FIT_CLEARANCE` (2 x 0.25mm); the body's corner
 * radius is `BOX_CORNER_RADIUS` (3.75mm) and the lid's effective radius is
 * `LID_CORNER_RADIUS - fitClearance` (4 - 0.25 = 3.75mm). Same numbers, so the
 * skirt's outer wall is flush with the bin's and the fuse has no sliver to
 * resolve.
 *
 * `buildLidFloor` is deliberately NOT used: a lid's floor plate is a tray's
 * own bin floor, so reusing it would stack two slabs. The mating shell is left
 * open at its top (Z=0) and the bin floor above closes the cavity.
 *
 * Runs after `translateStage`, which has already lifted the body by
 * `dimensions.baseOffsetZ` — the skirt's depth. The skirt is built in lid-local
 * coords (top face at Z=0, hanging into negative Z) and raised by that same
 * offset, so it lands in `[0, baseOffsetZ]` directly under the floor and Z=0
 * stays the absolute bottom.
 */

import { translate, unwrap, fuse, withScope } from 'brepjs';
import type { DisposalScope, Shape3D, ValidSolid } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { checkCancelled } from '../../utils/abort';
import { buildMatingShell } from '../../lidProfile';
import { addClickRails, hasAnyClickRail } from '../../lidClickRail';
import { addLidRetentionMagnets } from '../../lidRetentionMagnets';
import { resolveTrayBottomInputs } from '../../trayBottomInputs';

export const trayBottomStage: PipelineStage = {
  name: 'merge',
  progressValue: 0.85,

  shouldRun(ctx: PipelineContext): boolean {
    return ctx.dimensions.isTrayBottom;
  },

  execute(ctx: PipelineContext): PipelineContext {
    if (!ctx.solid) return ctx;
    checkCancelled(ctx.signal);

    const inputs = resolveTrayBottomInputs(ctx.params);
    const body = ctx.solid;

    const fused = withScope((scope: DisposalScope) => {
      let skirt: Shape3D = buildMatingShell(scope, inputs);
      scope.register(skirt);

      if (hasAnyClickRail(inputs.clickRails)) {
        skirt = addClickRails(scope, skirt, inputs);
      }
      if (inputs.retentionMagnets) {
        skirt = addLidRetentionMagnets(scope, skirt, inputs);
      }

      const seated = scope.register(translate(skirt, [0, 0, ctx.dimensions.baseOffsetZ]));
      return unwrap(fuse(body as ValidSolid, seated as ValidSolid));
    });

    body.delete();
    return { ...ctx, solid: fused };
  },
};
