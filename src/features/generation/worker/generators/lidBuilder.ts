/**
 * Click-lock lid geometry builder.
 *
 * Produces a standalone lid solid that mates with a Gridfinity bin's
 * stacking lip. The lid is built in lid-local coordinates so it can be
 * positioned and exported independently of the bin.
 *
 * Geometry breakdown (in build order):
 *   - `buildLidFloor`     — flat plate at the top              (lidProfile)
 *   - `buildMatingShell`  — inverted-lip wall                  (lidProfile)
 *   - `addClickRails`     — tapered snap rails on each wall    (lidClickRail)
 *   - `cutMagnetHoles`    — standard magnet pattern through floor (lidMagnets)
 *   - `buildStackGrid`    — Gridfinity lip profile on top      (lidStackGrid)
 *
 * Coordinate convention:
 *   Z = 0          : top of lid floor
 *   Z = -topThickness : bottom of lid floor (top of mating cavity)
 *   Z negative     : mating shell + click rails (extend down over bin lip)
 *   Z positive     : optional Gridfinity stack grid
 *
 * Supports both rectangular and non-rectangular (cellMask polygon) bin
 * footprints. For polygon bins, all profiles follow the polygon outline,
 * click rails are placed per straight edge, and magnet holes are skipped
 * in unfilled cells.
 */

import { unwrap, fuse, withScope } from 'brepjs';
import type { Shape3D, DisposalScope, ValidSolid } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';
import { resolveLidInputs } from './lidInputs';
import { buildLidFloor, buildMatingShell } from './lidProfile';
import { addClickRails } from './lidClickRail';
import { buildStackGrid } from './lidStackGrid';
import { cutMagnetHoles } from './lidMagnets';

export { resolveLidInputs } from './lidInputs';
export { chamferApexXForCavityWall } from './lidClickRail';

/**
 * Build the click-lock lid as a single brepjs solid in lid-local coordinates.
 *
 * Caller is responsible for the returned solid's lifetime; this function
 * uses an internal `withScope` so all intermediates are released.
 *
 * @param params bin params (reads `params.lid` and related)
 * @param originToTag optional map populated with face-origin → FeatureTag
 *   entries. Pass an empty Map to receive face-group provenance for the
 *   built lid; rails get tagged `LID_RAIL`, body shapes get `LID_BODY`,
 *   so consumers can render the lid with rail-precision hover effects.
 */
export function buildLid(params: BinParams, originToTag?: Map<number, number>): Shape3D {
  const inputs = resolveLidInputs(params);

  return withScope((scope: DisposalScope) => {
    // 1. Floor + mating shell — fused into the main body
    const floor = buildLidFloor(scope, inputs);
    const matingShell = scope.register(buildMatingShell(scope, inputs));
    if (originToTag) {
      // Tag the body shapes BEFORE fusing — origins from these shapes are
      // what surface in the post-fuse face groups.
      collectOrigins(floor, FeatureTag.LID_BODY, originToTag);
      collectOrigins(matingShell, FeatureTag.LID_BODY, originToTag);
    }
    let body: Shape3D = unwrap(fuse(floor, matingShell));

    // 2. Click rails — fuse onto the mating shell from outside (tags rails).
    // Skipped entirely when no side has rails enabled, producing a
    // friction-fit lid (mating cavity still wraps the lip; just no
    // positive snap). The placement functions also gate per-side, but
    // the early skip avoids the boolean-op overhead for friction-fit lids.
    const { clickRails } = inputs;
    const anyRail = clickRails.front || clickRails.back || clickRails.left || clickRails.right;
    if (anyRail) {
      body = addClickRails(scope, body, inputs, originToTag);
    }

    // 3. Optional magnet holes through the floor.
    //    Cut BEFORE the stack grid fuses on top: the cylinder's 0.1mm
    //    coplanar overshoot above Z=0 would otherwise hang inside the
    //    pocket cavity (a void INSIDE the body), and some OCCT/WASM
    //    builds produce malformed output when trimming a cutter whose
    //    top sits in an internal void (issue #1655). Cut-first makes
    //    the overshoot land in empty space ABOVE the body — a clean
    //    through-cut. Order swap is safe because magnet positions sit
    //    inside the pocket footprint, so cylinders never touch the slab.
    if (inputs.magnetHoles) {
      body = cutMagnetHoles(scope, body, inputs);
    }

    // 4. Optional Gridfinity stack grid on top. Skipped when the user opted
    //    to print the baseplate separately (`separateStackPlate`) — then the
    //    grid ships as its own solid via `buildStackPlate` and the lid keeps a
    //    flat, glueable top.
    if (inputs.stackableTop && !inputs.separateStackPlate) {
      const stackGrid = scope.register(buildStackGrid(scope, inputs));
      if (originToTag) {
        collectOrigins(stackGrid, FeatureTag.LID_BODY, originToTag);
      }
      scope.register(body);
      body = unwrap(fuse(body, stackGrid));
    }

    return body as ValidSolid;
  });
}

/**
 * Build the standalone stack-grid baseplate as a single brepjs solid in
 * lid-local coordinates (slab bottom at Z=0 = the glue face, pockets opening
 * upward). Returns null unless the lid opts into a separate baseplate
 * (`separateStackPlate`, already gated on `stackableTop`).
 *
 * The slab is the SAME geometry `buildLid` would otherwise fuse on top, so a
 * glued assembly is dimensionally identical to a one-piece stackable lid. It's
 * already print-ready (flat bottom on the bed), so — unlike the lid — the
 * export path must NOT reorient it.
 *
 * Caller owns the returned solid's lifetime.
 */
export function buildStackPlate(params: BinParams): Shape3D | null {
  const inputs = resolveLidInputs(params);
  if (!inputs.separateStackPlate) return null;
  return withScope((scope: DisposalScope) => buildStackGrid(scope, inputs) as ValidSolid);
}
