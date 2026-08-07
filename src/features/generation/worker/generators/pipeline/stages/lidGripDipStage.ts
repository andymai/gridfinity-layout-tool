/**
 * Lid-grip dip stage — bin-side relief in the stacking lip (#3272).
 *
 * The lid's grip relief gives a fingernail somewhere to go. The dip is the
 * other half: it takes the bin's stacking lip down over the same span so a
 * fingertip gets UNDER the lid's skirt rather than only against it.
 *
 * Registration is free rather than arranged. The lid's outer perimeter is
 * `width * pitch - 2 * LID_FIT_CLEARANCE` and the bin's is
 * `width * pitch - CLEARANCE`, and those are the same number — the seam is
 * flush — so the dip reuses `gripPlacements` outright and cannot land out of
 * line with the relief above it.
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
import { hasBinLipDip, LID_GRIP_MIN_WALL_MM } from '@/shared/types/bin';
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
    // the depth clamp — so a dip can never outlive the relief it belongs to.
    return ctx.solid !== null && hasBinLipDip(ctx.params);
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

    // Same rim derivation as `lidRetentionStage`: a tray bin's floor sits on a
    // skirt, so `totalHeight` alone would place the dip down inside it.
    const rimZ = dim.baseOffsetZ + dim.totalHeight;
    const lipBottomZ = rimZ - LIP_HEIGHT;
    const M = LID_COPLANAR_MARGIN;

    const cutters: Shape3D[] = [];
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
      const oriented =
        place.rotationDeg === 0 ? centred : rotate(centred, place.rotationDeg, { axis: [0, 0, 1] });
      cutters.push(translate(oriented, [place.centerX, place.centerY, 0]));
    }

    const result = unwrap(cutAll(ctx.solid as ValidSolid, cutters as ValidSolid[]));
    for (const cutter of cutters) cutter.delete();
    if (result !== ctx.solid) ctx.solid.delete();
    collectOrigins(result, FeatureTag.LID_GRIP, ctx.originToTag);

    return { ...ctx, solid: result };
  },
};
