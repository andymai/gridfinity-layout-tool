/**
 * Swappable-label sockets cut into a shadow board's fill surface.
 *
 * Each socket is delivered as a SINGLE cut tool (the pocket prism with the
 * retention ribs subtracted from it) rather than as a pocket cut plus fused
 * ribs. The boolean stage fuses before it cuts, so ribs handed over as fuse
 * targets would be welded on and then carved straight back out by the pocket
 * that arrives after them; the plate would find nothing to click behind. The
 * composed negative also isolates failure: one tool per socket means a boolean
 * that throws costs that socket and nothing else.
 *
 * Pocket dimensions, rib band and clearances all come from
 * `@/shared/constants/labelPlates`, the same numbers the compartment shelf
 * cuts with, so a plate printed for one seats in the other.
 */

import {
  cut,
  drawRoundedRectangle,
  draw,
  rotate,
  translate,
  unwrap,
  withScope,
  clone,
  setShapeOrigin,
} from 'brepjs';
import type { Shape3D, ValidSolid, DisposalScope } from 'brepjs';
import { COPLANAR_MARGIN } from './generatorConstants';
import {
  LABEL_PLATE_CORNER_RADIUS_MM,
  LABEL_PLATE_HEIGHT_MM,
  LABEL_SOCKET_CLICK_POCKET_DEPTH_MM,
  LABEL_SOCKET_RIB_HEIGHT_MM,
  LABEL_SOCKET_RIB_PROTRUSION_MM,
  LABEL_SOCKET_RIB_START_MM,
  effectiveLabelSocketClearance,
  labelPlateWidthMm,
} from '@/shared/constants/labelPlates';
import type { LabelPlateWidthU } from '@/shared/constants/labelPlates';
import type { BinParams } from '@/shared/types/bin';
import { cutoutSocketTopZ, planCutoutSocketsForParams } from '@/shared/utils/cutoutLabelSocketPlan';
import type { CutoutSocketPlacement } from '@/shared/utils/cutoutLabelSocketPlan';
import { sketch } from './meshUtils';
import { FeatureTag } from './featureTags';

/**
 * Rib embedding into the pocket wall (mm). In the composed-negative form this
 * is not a seam guard but a containment one: a rib flush with the wall would
 * leave the subtraction bounded by two coincident faces, which OCCT resolves
 * unreliably. Material outside the pocket is untouched either way.
 */
const RIB_EMBED_MM = 0.1;

export interface CutoutSocketCutterContext {
  readonly centerX: number;
  readonly centerY: number;
  /** Pocket top plane: the fill surface, less any stacking sink. */
  readonly topZ: number;
  readonly plateWidthU: LabelPlateWidthU;
  readonly clearanceMm: number;
  /** True for a 90° socket: the whole negative is turned about its center. */
  readonly vertical: boolean;
}

/**
 * The negative that cuts one click-in socket: pocket minus both ribs.
 *
 * Built in the horizontal frame at the origin and turned as a whole for a
 * vertical socket, so the two orientations cannot describe different geometry
 * because there is only one rib placement to get right.
 */
export function buildCutoutSocketCutter(
  scope: DisposalScope,
  ctx: CutoutSocketCutterContext
): Shape3D {
  const pocketW = labelPlateWidthMm(ctx.plateWidthU) + ctx.clearanceMm;
  const pocketD = LABEL_PLATE_HEIGHT_MM + ctx.clearanceMm;
  const floorZ = ctx.topZ - LABEL_SOCKET_CLICK_POCKET_DEPTH_MM;

  // The pocket runs COPLANAR_MARGIN past the surface: a cutter ending exactly
  // on the face it opens through leaves the boolean two coincident planes.
  let cutter: Shape3D = scope.register(
    sketch(
      drawRoundedRectangle(pocketW, pocketD, LABEL_PLATE_CORNER_RADIUS_MM),
      'XY',
      floorZ
    ).extrude(LABEL_SOCKET_CLICK_POCKET_DEPTH_MM + COPLANAR_MARGIN)
  );

  const ribT = LABEL_SOCKET_RIB_PROTRUSION_MM + RIB_EMBED_MM;
  const ribZ0 = floorZ + LABEL_SOCKET_RIB_START_MM;
  const ribProfile = draw([-pocketW / 2, -ribT / 2])
    .lineTo([pocketW / 2, -ribT / 2])
    .lineTo([pocketW / 2, ribT / 2])
    .lineTo([-pocketW / 2, ribT / 2])
    .close();
  for (const side of [-1, 1] as const) {
    const wallY = (side * pocketD) / 2;
    const ribCenterY = wallY - side * (ribT / 2 - RIB_EMBED_MM);
    const rib = scope.register(
      translate(
        scope.register(sketch(ribProfile, 'XY', ribZ0).extrude(LABEL_SOCKET_RIB_HEIGHT_MM)),
        [0, ribCenterY, 0]
      )
    );
    cutter = scope.register(unwrap(cut(cutter as ValidSolid, rib as ValidSolid)));
  }

  if (ctx.vertical) {
    cutter = scope.register(rotate(cutter, 90, { axis: [0, 0, 1] }));
  }
  return scope.register(translate(cutter, [ctx.centerX, ctx.centerY, 0]));
}

/**
 * Cut tools for every socket in a plan, tagged as label geometry so the
 * pocket takes the label feature's colour rather than the board's.
 *
 * Best-effort per socket: a negative that fails to build costs that socket
 * alone, leaving an unmarked board rather than no board.
 */
export function buildCutoutSocketCutters(
  sockets: readonly CutoutSocketPlacement[],
  topZ: number,
  clearanceMm: number
): Shape3D[] {
  const tools: Shape3D[] = [];
  for (const socket of sockets) {
    try {
      const tool = withScope((scope: DisposalScope): Shape3D => {
        const cutter = buildCutoutSocketCutter(scope, {
          centerX: socket.centerX,
          centerY: socket.centerY,
          topZ,
          plateWidthU: socket.widthU,
          clearanceMm,
          vertical: socket.vertical,
        });
        return unwrap(clone(cutter));
      });
      setShapeOrigin(tool, FeatureTag.LABEL_TAB);
      tools.push(tool);
    } catch {
      // Skip this socket; the rest of the board still builds.
    }
  }
  return tools;
}

/**
 * Every socket a shadow board's cutouts ask for, as cut tools in the bin's
 * centred frame.
 *
 * Planned against the FULL cutout list, not the extrudable subset
 * `buildCutoutCuts` narrows to: a mesh-imprint cavity is still a hole in the
 * board, so it must obstruct a neighbouring pocket even though its own cut
 * happens after tessellation.
 */
export function buildCutoutLabelSocketTools(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
): Shape3D[] {
  const { sockets } = planCutoutSocketsForParams(params, innerW, innerD, wallHeight);
  if (sockets.length === 0) return [];

  return buildCutoutSocketCutters(
    sockets,
    cutoutSocketTopZ(params, wallHeight),
    effectiveLabelSocketClearance(params.nozzleSizeMm, params.label.plateFitOffset)
  );
}
