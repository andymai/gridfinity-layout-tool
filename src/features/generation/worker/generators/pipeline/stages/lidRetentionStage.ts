/**
 * Lid-retention stage — bin-side magnet gusset pads (issue #2694).
 *
 * When the design's lid uses magnetic retention, each corner of the bin grows a
 * gusset pad: a solid that anchors to the two interior corner walls near the top
 * and cantilevers inward to house a vertical magnet pocket opening UPWARD. The
 * mating lid boss hangs down to meet it — the pad top sits one
 * `LID_MAGNET_SEAT_GAP` below the lid boss's bottom face when the lid is seated,
 * so the two magnets mate across a thin gap.
 *
 * The pad prints support-free (issue #2712): its underside is a single 45°
 * plane rising along the corner diagonal, from the wall corner up to the pad
 * bottom at the tip. Each layer overhangs the one below by at most the layer
 * height, so the slicer never asks for supports inside the bin. On bins too
 * short for the full taper it clamps to the interior floor and welds in. The
 * pad's inward-pointing corner is rounded at the boss radius (a tongue wrapping
 * the pocket) so contents can't snag on it; the other three corners stay square
 * because they sit buried inside the walls.
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

import { cylinder, draw, rotate, translate, unwrap, fuse, cut, cutAll } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { shouldGenerateLid } from '@/shared/types/bin';
import { checkCancelled } from '../../utils/abort';
import {
  LID_COPLANAR_MARGIN,
  LID_MAGNET_POST_FLOOR,
  LID_MAGNET_SEAT_GAP,
  LID_MIN_CORNER_RADIUS,
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

    // Cap the pocket at what the recessed pad can hold while keeping POST_FLOOR
    // of pad below the magnet. `availableForPocket` is guaranteed positive when
    // this stage runs (the `magnetTooDeepForBin` blocker rejects magnets that
    // don't fit), but clamp to >= 0 defensively so a marginal design never
    // inverts the pocket. The pad bottom is additionally clamped to the interior
    // floor so a deep magnet can never dig a pocket through it.
    const floorTopZ = dim.totalHeight - dim.interiorHeight;
    const recessDepth = dim.totalHeight - magnetTopZ;
    const availableForPocket = Math.max(
      0,
      dim.interiorHeight - recessDepth - LID_MAGNET_POST_FLOOR
    );
    const pocketDepth = Math.min(depth, availableForPocket);
    const padBottomZ = Math.max(floorTopZ, magnetTopZ - pocketDepth - LID_MAGNET_POST_FLOOR);

    const innerHalfW = dim.innerW / 2;
    const innerHalfD = dim.innerD / 2;

    let body: Shape3D = ctx.solid;

    // 1. Fuse a gusset pad into each corner. The pad's footprint spans from the
    //    interior wall corner (with a small overlap for a solid weld) inward
    //    past the magnet; its inward corner is rounded at the boss radius so
    //    the pad ends in a smooth tongue wrapping the pocket (#2712). Below
    //    `padBottomZ` the pad continues down as a 45° taper: a single plane
    //    rising along the corner diagonal from the wall corner to the tongue
    //    tip, so the underside prints support-free.
    for (const [px, py] of positions) {
      const sx = Math.sign(px);
      const sy = Math.sign(py);
      const wallX = sx * (innerHalfW + GUSSET_WALL_OVERLAP);
      const wallY = sy * (innerHalfD + GUSSET_WALL_OVERLAP);
      const innerX = px - sx * bossRadius;
      const innerY = py - sy * bossRadius;
      const sizeX = Math.abs(wallX - innerX);
      const sizeY = Math.abs(wallY - innerY);
      const tongueR = Math.max(
        LID_MIN_CORNER_RADIUS,
        Math.min(bossRadius, sizeX - LID_MIN_CORNER_RADIUS, sizeY - LID_MIN_CORNER_RADIUS)
      );

      // Taper depth along the diagonal: chosen so the 45° plane meets the pad
      // bottom exactly at the rounded tongue's tip — no residual flat overhang.
      // (A sharp corner would need (sizeX+sizeY)/√2; the rounding pulls the
      // tip back by (2−√2)·tongueR of diagonal travel.)
      const taperDepth = (sizeX + sizeY - (2 - Math.SQRT2) * tongueR) / Math.SQRT2;
      const taperBottomZ = padBottomZ - taperDepth;
      // Clamp to the interior floor, welding in by a coplanar margin so a
      // truncated taper never leaves a boolean-hostile face-on-face contact.
      const flatBottomZ =
        taperBottomZ < floorTopZ + LID_COPLANAR_MARGIN
          ? floorTopZ - LID_COPLANAR_MARGIN
          : taperBottomZ;

      // Footprint: three square corners buried in the walls, one rounded
      // tongue. Positive sagitta bows left of travel (see
      // sagittaArcConvention.test.ts); the arc must bow toward the removed
      // corner. Every corner is drawn COUNTER-clockwise — mirroring one path
      // template across the corners would flip the winding on half of them,
      // which inverts the extruded solid's face orientation and ships flipped
      // shading normals in the tessellated mesh.
      const sagitta = -sx * sy * tongueR * (1 - Math.SQRT1_2);
      const footprint =
        sx * sy > 0
          ? draw([wallX, wallY])
              .lineTo([innerX, wallY])
              .lineTo([innerX, innerY + sy * tongueR])
              .sagittaArcTo([innerX + sx * tongueR, innerY], sagitta)
              .lineTo([wallX, innerY])
              .close()
          : draw([wallX, wallY])
              .lineTo([wallX, innerY])
              .lineTo([innerX + sx * tongueR, innerY])
              .sagittaArcTo([innerX, innerY + sy * tongueR], -sagitta)
              .lineTo([innerX, wallY])
              .close();
      const padExt = footprint.sketchOnPlane('XY', flatBottomZ).extrude(magnetTopZ - flatBottomZ);

      // Wedge cutter for the 45° underside, built in a canonical frame where
      // +X is the diagonal rise direction (u = distance along the diagonal
      // from the wall corner) and the prism spans Y symmetrically, then
      // rotated onto the corner diagonal and moved to the wall corner. Only
      // the sloped top face matters; the rest sits clear of the pad.
      const zLow = Math.min(flatBottomZ, taperBottomZ) - 2;
      const spanL = sizeX + sizeY + 4;
      // 'XZ' extrudes toward -Y (same convention wallPatternClips relies on),
      // so center the prism with an explicit +spanL/2 shift before rotating.
      // Wound so the cutter solid's faces are outward-oriented — the sloped
      // face it carves into the pad inherits this orientation, and a reversed
      // winding would ship a flipped shading normal on the visible taper.
      const wedgeRaw = draw([-1, taperBottomZ - 1])
        .lineTo([-1, zLow])
        .lineTo([taperDepth + 1, zLow])
        .lineTo([taperDepth + 1, padBottomZ + 1])
        .close()
        .sketchOnPlane('XZ')
        .extrude(spanL);
      const wedgeCentered = translate(wedgeRaw, [0, spanL / 2, 0]);
      wedgeRaw.delete();
      const wedgeRotated = rotate(wedgeCentered, (Math.atan2(-sy, -sx) * 180) / Math.PI, {
        axis: [0, 0, 1],
      });
      wedgeCentered.delete();
      const wedge = translate(wedgeRotated, [wallX, wallY, 0]);
      wedgeRotated.delete();

      const pad = unwrap(cut(padExt as ValidSolid, wedge as ValidSolid));
      padExt.delete();
      wedge.delete();

      const fused = unwrap(fuse(body as ValidSolid, pad));
      pad.delete();
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

    const pocketed = unwrap(cutAll(body as ValidSolid, cutters as ValidSolid[]));
    for (const c of cutters) c.delete();
    body.delete();

    return { ...ctx, solid: pocketed };
  },
};
