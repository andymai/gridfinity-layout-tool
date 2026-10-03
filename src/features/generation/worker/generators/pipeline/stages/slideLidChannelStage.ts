/**
 * Sliding-lid channel — fuse the track onto the bin and cut the entry window.
 *
 * ORDER. After `lidInteriorReliefStage`, and that is the feature rather than an
 * accident: the relief cuts the plate's whole travel envelope out of the
 * cavity, and the channel is what the plate runs ON. Fusing first would put the
 * shelves and retainers inside the envelope, and the relief would take the
 * track back off again. `lidRetentionStage` sits in the same position for the
 * same reason — a magnetic lid's corner pads are interface, not contents.
 *
 * A thin wall's lining goes before all of it, since the relief and the bars
 * are laid out against the face it builds.
 *
 * Within the stage both CUTS go before the fuse. The mouth relief carries the
 * channel's profile through the cavity's entry corner arcs, and the bars run
 * into those arcs; the notch opens the entry wall, and the entry bars run
 * through it to the outer face. Cut afterwards, either would saw the shelf and
 * retainer off inside it. The bars never reach into the plate's slot, so
 * refilling the window with them leaves it open. A finger catch's lip cut is
 * the one that follows the fuse: it ends the retainers flush with the lip.
 *
 * Runs after `translateStage`, so Z is final world Z.
 */

import { unwrap, fuseAll, cutAll } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { isSlideLid, shouldGenerateLid, slideLidPlanForParams } from '@/shared/types/bin';
import { checkCancelled } from '../../utils/abort';
import { FeatureTag } from '../../featureTags';
import { collectOrigins } from '../collectOrigins';
import { buildSlideLidChannel, slideLidPlateTopZ } from '../../slideLidChannel';

export const slideLidChannelStage: PipelineStage = {
  name: 'merge',
  progressValue: 0.83,

  shouldRun(ctx: PipelineContext): boolean {
    // Both halves, exactly as `lidGripDipStage` pairs them: `isSlideLid` says
    // the design describes a sliding lid, `shouldGenerateLid` says one is
    // actually being built. Without the second, a design with `lid.enabled:
    // false` — or one a compatibility blocker has disqualified — would ship a
    // bin with a channel and a hole in its rim and no lid to justify either.
    return ctx.solid !== null && isSlideLid(ctx.params.lid) && shouldGenerateLid(ctx.params);
  },

  execute(ctx: PipelineContext): PipelineContext {
    if (!ctx.solid) return ctx;
    checkCancelled(ctx.signal);

    const { params, dimensions: dim } = ctx;
    const { geometry } = slideLidPlanForParams(params);
    if (!geometry) return ctx;

    const { linings, mouthCuts, additions, subtractions, finishingCuts } = buildSlideLidChannel(
      geometry,
      slideLidPlateTopZ(dim, geometry),
      dim.innerOffsetX,
      dim.innerOffsetY
    );

    // Tag the PARTS, never the result: `setShapeOrigin` replaces a shape's whole
    // face-origin map, so tagging the post-boolean solid would stamp the entire
    // bin — taking LIP with it, which is the sole key the per-cell multicolour
    // lip is built from.
    const parts = [...linings, ...mouthCuts, ...additions, ...subtractions, ...finishingCuts];
    for (const part of parts) {
      collectOrigins(part, FeatureTag.SLIDE_LID_CHANNEL, ctx.originToTag);
    }

    // This stage runs outside a DisposalScope, so every intermediate has to be
    // freed by hand or it leaks on each regeneration — and the designer
    // regenerates on every parameter change.
    let solid: Shape3D = ctx.solid;
    const scratch: Shape3D[] = [];
    try {
      if (linings.length > 0) {
        const lined = unwrap(fuseAll([solid, ...linings] as ValidSolid[]));
        scratch.push(lined);
        solid = lined;
      }
      const cuts = [...mouthCuts, ...subtractions];
      if (cuts.length > 0) {
        const relieved = unwrap(cutAll(solid as ValidSolid, cuts as ValidSolid[]));
        scratch.push(relieved);
        solid = relieved;
      }
      if (additions.length > 0) {
        const fused = unwrap(fuseAll([solid, ...additions] as ValidSolid[]));
        scratch.push(fused);
        solid = fused;
      }
      if (finishingCuts.length > 0) {
        const finished = unwrap(cutAll(solid as ValidSolid, finishingCuts as ValidSolid[]));
        scratch.push(finished);
        solid = finished;
      }
    } finally {
      for (const part of parts) part.delete();
      // Everything built along the way except the survivor.
      for (const s of scratch) {
        if (s !== solid) s.delete();
      }
    }

    if (solid !== ctx.solid) ctx.solid.delete();
    return { ...ctx, solid };
  },
};
