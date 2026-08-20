/**
 * Lid-hinge stage — the bin's half of the barrel.
 *
 * Notches the stacking lip wherever the LID owns a knuckle, then fuses on the
 * knuckles the BIN owns. Both come from `buildBinHingeParts`, which cuts them
 * out of one modelled barrel, so the two halves of the joint cannot drift.
 *
 * Runs LAST of the solid stages, after `lidGripDipStage`, and the order is
 * load-bearing rather than incidental. Everything before it that touches the
 * rim — the interior relief, a magnetic lid's corner pads, a sliding lid's
 * channel, a grip relief's bin dip — is free to reshape the lip without
 * knowing a hinge exists, and the knuckles are welded onto whatever survives.
 * Put this earlier and any one of them could quietly eat a knuckle root, which
 * is a defect no mesh statistic would show: the bin stays watertight, the
 * knuckle is simply thinner than it was drawn, and the hinge snaps in use.
 * It is the same argument that puts `lid.relieveInterior` last (CLAUDE.md
 * gotcha #18) — tree order enforcing a rule so nobody has to remember it.
 *
 * The bin needs its knuckles whether or not the lid is exported in the same
 * action, so this keys off the plan alone and not on the lid being emitted —
 * exactly as `lidRetentionStage` keys off `usesMagneticLid`.
 */

import { cutAll, fuseAll, unwrap } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { checkCancelled } from '../../utils/abort';
import { buildBinHingeParts } from '../../hingeBarrel';
import { collectOrigins } from '../collectOrigins';
import { FeatureTag } from '../../featureTags';
import { planHingeLid } from '@/shared/utils/hingeLidPlan';
import { shouldGenerateLid } from '@/shared/types/bin';

export const lidHingeStage: PipelineStage = {
  name: 'merge',
  progressValue: 0.87,

  shouldRun(ctx: PipelineContext): boolean {
    // BOTH gates, exactly as `lidRetentionStage` takes both. The plan says the
    // hinge is buildable; `shouldGenerateLid` says the lid will actually be
    // emitted. A lid blocked by a compatibility issue is never generated or
    // exported, and without the second gate the bin would keep a barrel and a
    // notched lip for a part that does not exist — orphan geometry that prints
    // and looks deliberate.
    //
    // Safe from the recursion CLAUDE.md gotcha #18 documents: `shouldGenerateLid`
    // reaches `checkLidCompatibility`, so `planHingeLid` must never call it back.
    // It does not, and must not start.
    return (
      ctx.solid !== null &&
      planHingeLid(ctx.params).geometry !== null &&
      shouldGenerateLid(ctx.params)
    );
  },

  execute(ctx: PipelineContext): PipelineContext {
    if (!ctx.solid) return ctx;
    checkCancelled(ctx.signal);

    const { geometry } = planHingeLid(ctx.params);
    if (!geometry) return ctx;

    const { dimensions: dim } = ctx;
    // The barrel is tangent to the OUTER face, which is the cavity's half-span
    // plus one wall. Under asymmetric overhang the cavity is not centred on the
    // bin, and `innerOffsetX/Y` is what carries that — the plan states the axis
    // as an inset from the face rather than as a coordinate precisely so this
    // is the only place the offset has to be applied.
    const alongX = geometry.alongX;
    const crossSpan = alongX ? dim.innerD : dim.innerW;
    const offset = alongX ? dim.innerOffsetY : dim.innerOffsetX;
    const outward = geometry.side === 'back' || geometry.side === 'right' ? 1 : -1;

    const { notches, additions, bores } = buildBinHingeParts(geometry, {
      outerFaceCrossMm: crossSpan / 2 + ctx.params.wallThickness + outward * offset,
      axisZ: dim.lipTopZ + geometry.axisAboveLipTopMm,
      rotationDeg: geometry.rotationDeg,
    });

    // Tag the PARTS, never the result: `setShapeOrigin` replaces a shape's
    // whole face-origin map, so tagging the post-boolean solid would stamp the
    // entire bin — the same trap `slideLidChannelStage` documents.
    for (const part of [...notches, ...additions, ...bores]) {
      collectOrigins(part, FeatureTag.LID_HINGE, ctx.originToTag);
    }

    // This stage runs outside a DisposalScope, so every intermediate has to be
    // freed by hand or it leaks on each regeneration — and the designer
    // regenerates on every parameter change.
    let solid: Shape3D = ctx.solid;
    const scratch: Shape3D[] = [];
    try {
      // Pockets, then knuckles, then bores — see `BinHingeSolids`. Boring
      // before the fuse drills through air and leaves the knuckles solid.
      if (notches.length > 0) {
        const pocketed = unwrap(cutAll(solid as ValidSolid, notches as ValidSolid[]));
        scratch.push(pocketed);
        solid = pocketed;
      }
      if (additions.length > 0) {
        const welded = unwrap(fuseAll([solid, ...additions] as ValidSolid[]));
        scratch.push(welded);
        solid = welded;
      }
      if (bores.length > 0) {
        const drilled = unwrap(cutAll(solid as ValidSolid, bores as ValidSolid[]));
        scratch.push(drilled);
        solid = drilled;
      }
    } finally {
      for (const part of [...notches, ...additions, ...bores]) part.delete();
      for (const s of scratch) {
        if (s !== solid) s.delete();
      }
    }

    if (solid !== ctx.solid) ctx.solid.delete();
    return { ...ctx, solid };
  },
};
