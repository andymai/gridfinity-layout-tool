/**
 * Lid-grip dip stage — bin-side relief in the stacking lip.
 *
 * The lid's grip relief gives a fingernail somewhere to go. The dip is the
 * other half: it takes the bin's stacking lip down over the same span so a
 * fingertip gets UNDER the lid's skirt rather than only against it.
 *
 * Registration comes free from reusing `gripPlacements`: the dip and the lid's
 * own relief are derived from one span, so they cannot drift apart. But the
 * placements are on the LID's perimeter, and only a friction or click-rail lid
 * shares the bin's — `width * pitch - 2 * LID_FIT_CLEARANCE` equals
 * `width * pitch - CLEARANCE` at the base clearance and no other. A magnetic
 * lid sits `LID_MAGNETIC_EXTRA_CLEARANCE` further in per side, so the cutter
 * has to reach back out that far or it stops short of the bin's face and
 * leaves a skin of lip standing across the whole dip.
 *
 * Two bounds, both deliberate:
 *
 * - VERTICAL: the full lip height, stopping exactly at the wall top. The lip
 *   is what an upper bin registers against, and removing it across a span is
 *   the cost the user accepted; cutting deeper would eat the wall itself.
 * - RADIAL: `LIP_TAPER_WIDTH`. `buildTopShape` builds the lip flush with the
 *   body at the rim and tapering INWARD by that much on the way down, so a cut
 *   of this depth from the outer face takes the lip's outward-facing profile
 *   over its full height and leaves the wall's own section carrying on to the
 *   rim. Clamping against `wallThickness` instead would be wrong twice over:
 *   it measures material the dip never touches, and at the 1.2mm default it
 *   resolves to zero and silently cuts nothing.
 *
 * The ends ramp at 45° rather than stopping square. A square end leaves two
 * vertical shoulders in a load-bearing interface — where an upper bin catches
 * when it slides on, and where a crack starts.
 *
 * Runs AFTER translate, so Z is final world Z; XY comes from the same
 * placement helper the lid uses.
 */

import { draw, rotate, translate, unwrap, cutAll } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import {
  hasBinLipDip,
  shouldGenerateLid,
  resolveLidFootprintClearance,
  LID_FIT_CLEARANCE,
  LID_GRIP_MIN_WALL_MM,
} from '@/shared/types/bin';
import { checkCancelled } from '../../utils/abort';
import { LIP_HEIGHT, LIP_TAPER_WIDTH } from '../../generatorConstants';
import { LID_COPLANAR_MARGIN } from '../../lidConstants';
import { resolveLidInputs } from '../../lidInputs';
import { gripPlacements } from '../../lidGripRelief';
import { FeatureTag } from '../../featureTags';
import { collectOrigins } from '../collectOrigins';

/**
 * Run (mm) each end of the dip takes to climb back to full lip height.
 *
 * Equal to the lip height, so the ramp is a 45° plane: shallow enough that an
 * upper bin's base slides across it, and steep enough that the dip does not
 * eat most of the wall on a short span.
 */
const DIP_RAMP_MM = LIP_HEIGHT;

export const lidGripDipStage: PipelineStage = {
  name: 'merge',
  progressValue: 0.84,

  shouldRun(ctx: PipelineContext): boolean {
    // `hasBinLipDip` folds in the relief's own gating — mode, enabled sides and
    // the depth clamp — but says nothing about whether a lid is being built at
    // all. `shouldGenerateLid` is the other half, exactly as `lidRetentionStage`
    // pairs them: without it a design with `lid.enabled: false`, or one a
    // compatibility blocker has disqualified, would ship a bin with a notched
    // stacking lip and no lid to justify it.
    return ctx.solid !== null && hasBinLipDip(ctx.params) && shouldGenerateLid(ctx.params);
  },

  execute(ctx: PipelineContext): PipelineContext {
    if (!ctx.solid) return ctx;
    checkCancelled(ctx.signal);

    const { params, dimensions: dim } = ctx;
    const inputs = resolveLidInputs(params);
    const placements = gripPlacements(inputs);
    if (placements.length === 0) return ctx;

    // The flare, and no more. Guarded against a hypothetical wall so thin that
    // even the flare's removal would leave nothing beside it.
    const depthMm = Math.min(
      LIP_TAPER_WIDTH,
      LIP_TAPER_WIDTH + params.wallThickness - LID_GRIP_MIN_WALL_MM
    );
    if (depthMm <= 0) return ctx;

    // The lip's own base plane, which `shellStage` seats on the body top and
    // `dimensions.wallTopZ` derives once. Do not restate it from `totalHeight`
    // — that is `height * heightUnitMm`, which excludes the collar and does not
    // track `wallHeight` across base styles, and a cutter `LIP_TAPER_WIDTH`
    // deep landed a millimetre off opens a slot straight into the cavity
    // through a 1.2mm wall. The result is still watertight, so only a probe
    // finds it.
    const lipBottomZ = dim.wallTopZ;
    // Outward overshoot: the coplanar margin PLUS however far the lid's
    // footprint is inboard of the bin's, so the cut reaches the bin face on a
    // magnetic lid as well as a flush one.
    const M = LID_COPLANAR_MARGIN + (resolveLidFootprintClearance(params) - LID_FIT_CLEARANCE);

    // Every `rotate`/`translate` returns a NEW OCCT shape. This stage runs
    // outside a DisposalScope, so each intermediate has to be freed by hand or
    // it leaks on every regeneration — and the designer regenerates on each
    // parameter change. `lidRetentionStage` frees its wedge intermediates the
    // same way.
    const cutters: Shape3D[] = [];
    const scratch: Shape3D[] = [];
    for (const place of placements) {
      // Elevation in (along-wall, vertical): full depth across the span, ramping
      // out to nothing over DIP_RAMP_MM at each end. Drawn in XY and stood
      // upright with a +90 rotation about X, which maps (x, y, z) -> (x, -z, y):
      // the drawing's vertical becomes +Z and the extrusion becomes -Y, i.e.
      // inward on the canonical back wall. A -90 rotation maps y -> -z instead
      // and silently builds the dip DOWNWARD into the wall — invisible on a
      // vertically symmetric profile, which is why the lid's scallop tolerates
      // it and this ramped profile does not. (`sketchOnPlane('XZ')` is the
      // other trap here: it negates its Y origin, and is unused in this
      // feature.)
      const half = place.spanMm / 2;
      const elevation = draw([-half, 0])
        .lineTo([half, 0])
        .lineTo([half + DIP_RAMP_MM, LIP_HEIGHT + M])
        .lineTo([-half - DIP_RAMP_MM, LIP_HEIGHT + M])
        .close();

      const slab = elevation.sketchOnPlane('XY', 0).extrude(depthMm + M);
      const upright = rotate(slab, 90, { axis: [1, 0, 0] });
      const centred = translate(upright, [0, M, lipBottomZ]);
      scratch.push(slab, upright, centred);
      const oriented =
        place.rotationDeg === 0 ? centred : rotate(centred, place.rotationDeg, { axis: [0, 0, 1] });
      if (oriented !== centred) scratch.push(oriented);
      const positioned = translate(oriented, [place.centerX, place.centerY, 0]);
      // Tag the CUTTER, never the result. `setShapeOrigin` replaces a shape's
      // whole face-origin map, so tagging the post-boolean solid would stamp
      // the entire bin `LID_GRIP` — taking `LIP` with it, which is the sole key
      // the per-cell multicolour lip is built from.
      collectOrigins(positioned, FeatureTag.LID_GRIP, ctx.originToTag);
      cutters.push(positioned);
    }

    const result = unwrap(cutAll(ctx.solid as ValidSolid, cutters as ValidSolid[]));
    for (const cutter of cutters) cutter.delete();
    for (const shape of scratch) shape.delete();
    if (result !== ctx.solid) ctx.solid.delete();

    return { ...ctx, solid: result };
  },
};
