/**
 * Lid-retention stage — bin-side magnet posts (issue #2694).
 *
 * When the design's lid uses magnetic retention, each corner of the bin grows
 * a post rising from the interior floor to the stacking-lip top, with a blind
 * magnet pocket opening UPWARD. The mating lid boss meets it across the seated
 * interface (the lip-top plane). The physical bin needs these whether or not
 * the lid is exported in the same action, so this keys off `usesMagneticLid`
 * (not on the lid being emitted).
 *
 * Runs AFTER translate so the solid is in final world Z (lip top at
 * `dimensions.totalHeight`); XY comes from the shared `retentionMagnetPositions`
 * so the posts line up with the lid's holes.
 */

import { cylinder, unwrap, fuse, cutAll } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { shouldGenerateLid } from '@/shared/types/bin';
import { checkCancelled } from '../../utils/abort';
import { LID_COPLANAR_MARGIN, LID_MAGNET_POST_FLOOR } from '../../lidConstants';
import {
  retentionBossRadius,
  retentionMagnetPositions,
  usesMagneticLid,
} from '../../retentionMagnetGeometry';

export const lidRetentionStage: PipelineStage = {
  name: 'merge',
  progressValue: 0.82,

  shouldRun(ctx: PipelineContext): boolean {
    // `usesMagneticLid` gates on the structural config (magnetic + lip +
    // rectangular); `shouldGenerateLid` additionally rejects blocking
    // compatibility issues (e.g. `magnetTooDeepForBin`). Both are required so a
    // blocked lid — which is never generated/exported — doesn't leave the bin
    // with orphan posts, or cut a too-deep pocket through the floor.
    return ctx.solid !== null && usesMagneticLid(ctx.params) && shouldGenerateLid(ctx.params);
  },

  execute(ctx: PipelineContext): PipelineContext {
    if (!ctx.solid) return ctx;
    checkCancelled(ctx.signal);

    const { params, dimensions: dim } = ctx;
    const { diameter, depth } = params.lid.retentionMagnet;
    const magnetRadius = diameter / 2;
    // Never cut deeper than leaves `LID_MAGNET_POST_FLOOR` of solid below the
    // pocket, so the post can't be punched through even if a design slips past
    // the `magnetTooDeepForBin` warning band. Clamped to > 0 so a tiny interior
    // still yields a real (if shallow) pocket rather than an inverted one.
    const pocketDepth = Math.max(0.4, Math.min(depth, dim.interiorHeight - LID_MAGNET_POST_FLOOR));
    const bossRadius = retentionBossRadius(diameter);
    const positions = retentionMagnetPositions(
      params.width,
      params.depth,
      dim.gridUnitMmX,
      dim.gridUnitMmY,
      bossRadius
    );

    // Lip top = the seated interface. Post rises from the interior floor to it.
    const interfaceZ = dim.totalHeight;
    const floorTopZ = dim.totalHeight - dim.interiorHeight;
    const postHeight = interfaceZ - floorTopZ;

    let body: Shape3D = ctx.solid;

    // 1. Fuse the four posts onto the body (welds to the floor + corner walls).
    for (const [px, py] of positions) {
      const post = cylinder(bossRadius, postHeight, { at: [px, py, floorTopZ], axis: [0, 0, 1] });
      const fused = unwrap(fuse(body as ValidSolid, post));
      post.delete();
      body.delete();
      body = fused;
    }

    // 2. Cut the upward-opening pockets. Cutter starts `pocketDepth` below the
    //    lip top and rises a hair past it so it bites cleanly through the top
    //    face, leaving at least `LID_MAGNET_POST_FLOOR` of post material below.
    const cutterZ = interfaceZ - pocketDepth;
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
