/**
 * Lid-retention stage — bin-side magnet gusset pads (issue #2694).
 *
 * When the design's lid uses magnetic retention, each corner of the bin grows a
 * gusset pad: a solid that anchors to the two interior corner walls near the top
 * and cantilevers inward (an overhang) to house a vertical magnet pocket opening
 * UPWARD. The mating lid boss hangs down to meet it — the pad top sits one
 * `LID_MAGNET_SEAT_GAP` below the lid boss's bottom face when the lid is seated,
 * so the two magnets mate across a thin gap.
 *
 * The magnet mating plane is recessed just below the rim so the lid magnet fits
 * entirely under the lid's top surface (no bump); this stage derives that plane
 * from the lid's `anchorZ`, which the export assembly pins to the bin lip top.
 * The physical bin needs the pads whether or not the lid is exported in the same
 * action, so this keys off `usesMagneticLid` (not on the lid being emitted).
 *
 * Runs AFTER translate so the solid is in final world Z (lip top at
 * `dimensions.totalHeight`); XY comes from the shared `retentionMagnetPositions`
 * so the pads line up with the lid's bosses.
 */

import { cylinder, drawRoundedRectangle, translate, unwrap, fuse, cutAll } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { shouldGenerateLid } from '@/shared/types/bin';
import { checkCancelled } from '../../utils/abort';
import {
  LID_COPLANAR_MARGIN,
  LID_MAGNET_POST_FLOOR,
  LID_MAGNET_SEAT_GAP,
} from '../../lidConstants';
import { resolveLidInputs } from '../../lidInputs';
import {
  retentionBossRadius,
  retentionMagnetInset,
  retentionMagnetPositions,
  usesMagneticLid,
} from '../../retentionMagnetGeometry';

/** Volumetric overlap (mm) of the gusset into the interior walls, so the fuse
 *  weld is solid rather than a boolean-hostile coplanar face. */
const GUSSET_WALL_OVERLAP = 0.4;

export const lidRetentionStage: PipelineStage = {
  name: 'merge',
  progressValue: 0.82,

  shouldRun(ctx: PipelineContext): boolean {
    // `usesMagneticLid` gates on the structural config (magnetic + lip +
    // rectangular); `shouldGenerateLid` additionally rejects blocking
    // compatibility issues (e.g. `magnetTooDeepForBin`). Both are required so a
    // blocked lid — which is never generated/exported — doesn't leave the bin
    // with orphan pads, or cut a too-deep pocket through the floor.
    return ctx.solid !== null && usesMagneticLid(ctx.params) && shouldGenerateLid(ctx.params);
  },

  execute(ctx: PipelineContext): PipelineContext {
    if (!ctx.solid) return ctx;
    checkCancelled(ctx.signal);

    const { params, dimensions: dim } = ctx;
    const { diameter, depth } = params.lid.retentionMagnet;
    const magnetRadius = diameter / 2;
    const bossRadius = retentionBossRadius(diameter);
    const inset = retentionMagnetInset(diameter);
    const positions = retentionMagnetPositions(
      params.width,
      params.depth,
      dim.gridUnitMmX,
      dim.gridUnitMmY,
      inset
    );

    // Derive the lid magnet's mating face from the SAME resolved lid inputs the
    // lid builder uses, so the two never drift: it sits at lid-local
    // -(topThickness + depth) (the magnet tucked under the lid floor). Map that
    // to world via the seating transform (lid-local Z + (totalHeight - anchorZ),
    // matching `exportHandler`'s lid lift); the bin magnet's upward face sits one
    // seat gap below so the magnets mate.
    const lidInputs = resolveLidInputs(params);
    const lidFaceWorldZ = -(lidInputs.topThickness + depth) + (dim.totalHeight - lidInputs.anchorZ);
    const magnetTopZ = lidFaceWorldZ - LID_MAGNET_SEAT_GAP;

    // Keep at least POST_FLOOR of pad below the magnet, and never dig below the
    // interior floor — clamp the pocket depth to what the recessed pad can hold.
    const recessDepth = dim.totalHeight - magnetTopZ;
    const availableForPocket = dim.interiorHeight - recessDepth - LID_MAGNET_POST_FLOOR;
    const pocketDepth = Math.max(0.4, Math.min(depth, availableForPocket));
    const padBottomZ = magnetTopZ - pocketDepth - LID_MAGNET_POST_FLOOR;
    const padHeight = magnetTopZ - padBottomZ;

    const innerHalfW = dim.innerW / 2;
    const innerHalfD = dim.innerD / 2;

    let body: Shape3D = ctx.solid;

    // 1. Fuse a gusset pad into each corner. The pad spans from the interior
    //    wall corner (with a small overlap for a solid weld) inward past the
    //    magnet, as a rounded box at the recessed pad height.
    for (const [px, py] of positions) {
      const sx = Math.sign(px);
      const sy = Math.sign(py);
      const wallX = sx * (innerHalfW + GUSSET_WALL_OVERLAP);
      const wallY = sy * (innerHalfD + GUSSET_WALL_OVERLAP);
      const innerX = px - sx * bossRadius;
      const innerY = py - sy * bossRadius;
      const centerX = (wallX + innerX) / 2;
      const centerY = (wallY + innerY) / 2;
      const sizeX = Math.abs(wallX - innerX);
      const sizeY = Math.abs(wallY - innerY);
      const cornerR = Math.max(0.1, Math.min(1.5, sizeX / 2 - 0.1, sizeY / 2 - 0.1));

      const pad = drawRoundedRectangle(sizeX, sizeY, cornerR)
        .sketchOnPlane('XY', padBottomZ)
        .extrude(padHeight);
      const positioned = translate(pad, [centerX, centerY, 0]);
      pad.delete();
      const fused = unwrap(fuse(body as ValidSolid, positioned as ValidSolid));
      positioned.delete();
      body.delete();
      body = fused;
    }

    // 2. Cut the upward-opening pockets. Cutter starts `pocketDepth` below the
    //    pad top and rises a hair past it so it bites cleanly through the top
    //    face, leaving POST_FLOOR of pad material below the magnet.
    const cutterZ = magnetTopZ - pocketDepth;
    const cutterHeight = pocketDepth + LID_COPLANAR_MARGIN;
    const cutters: Shape3D[] = [];
    for (const [px, py] of positions) {
      cutters.push(
        cylinder(magnetRadius, cutterHeight, { at: [px, py, cutterZ], axis: [0, 0, 1] })
      );
    }

    const cut = unwrap(cutAll(body as ValidSolid, cutters as ValidSolid[]));
    for (const c of cutters) c.delete();
    body.delete();

    return { ...ctx, solid: cut };
  },
};
