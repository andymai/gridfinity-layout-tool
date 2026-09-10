/** Cuts a label plate socket (click-in pocket or slide channel) into a finished tab. */

import { draw, drawRoundedRectangle, unwrap, fuse, cut, translate } from 'brepjs';
import type { Shape3D, ValidSolid, DisposalScope } from 'brepjs';
import { COPLANAR_MARGIN } from './generatorConstants';
import {
  LABEL_PLATE_CORNER_RADIUS_MM,
  LABEL_PLATE_HEIGHT_MM,
  LABEL_SOCKET_CLICK_POCKET_DEPTH_MM,
  LABEL_SOCKET_DETENT_DEPTH_MM,
  LABEL_SOCKET_DETENT_HEIGHT_MM,
  LABEL_SOCKET_LIP_OVERHANG_MM,
  LABEL_SOCKET_LIP_THICKNESS_MM,
  LABEL_SOCKET_POCKET_DEPTH_MM,
  LABEL_SOCKET_RIB_HEIGHT_MM,
  LABEL_SOCKET_RIB_PROTRUSION_MM,
  LABEL_SOCKET_RIB_START_MM,
  LABEL_SOCKET_SLIDE_Z_CLEARANCE_MM,
  LABEL_SOCKET_WALL_MM,
  labelPlateWidthMm,
} from '@/shared/constants/labelPlates';
import type { LabelPlateWidthU, LabelSocketStyle } from '@/shared/constants/labelPlates';
import { sketch } from './meshUtils';

/**
 * Cut a swappable-label socket into the shelf top and fuse the retention
 * ribs. Local tab frame: shelf spans X:[0,tabWidth],
 * Y:[depthSign·tabDepth, 0] with the shelf top at Z=tabHeight.
 *
 * Pocket = plate footprint + total clearance, one pocket-wall margin in
 * from the anchor wall, placed along X by `alignment`. Ribs sit on the two
 * long (X-parallel) pocket walls: 0.2mm proud, 0.4mm tall, starting 0.2mm
 * above the pocket floor — the band the plate's perimeter latch clicks
 * behind.
 *
 * Best-effort like `applyTabText`: geometry that doesn't fit or a boolean
 * that throws leaves the plain shelf rather than tanking the tab build.
 */
export function applySocket(
  scope: DisposalScope,
  tabSolid: Shape3D,
  ctx: {
    plateWidthU: LabelPlateWidthU;
    clearanceMm: number;
    style: LabelSocketStyle;
    tabWidth: number;
    tabDepth: number;
    tabHeight: number;
    alignment: 'left' | 'center' | 'right';
    depthSign: 1 | -1;
  }
): Shape3D {
  const wall = LABEL_SOCKET_WALL_MM;
  const pocketW = labelPlateWidthMm(ctx.plateWidthU) + ctx.clearanceMm;
  const pocketD = LABEL_PLATE_HEIGHT_MM + ctx.clearanceMm;

  // Defense in depth: the plan already sized the plate to the tab width, but
  // a crafted payload (short depth, huge fit offset) could still overflow.
  if (pocketW + 2 * wall > ctx.tabWidth + 0.01) return tabSolid;
  if (pocketD + 2 * wall > ctx.tabDepth + 0.01) return tabSolid;

  let pocketX0: number;
  if (ctx.alignment === 'left') {
    pocketX0 = wall;
  } else if (ctx.alignment === 'right') {
    pocketX0 = ctx.tabWidth - wall - pocketW;
  } else {
    pocketX0 = (ctx.tabWidth - pocketW) / 2;
  }
  const centerX = pocketX0 + pocketW / 2;
  const centerY = ctx.depthSign * (wall + pocketD / 2);

  try {
    return cutLabelSocket(scope, tabSolid, {
      centerX,
      centerY,
      topZ: ctx.tabHeight,
      plateWidthU: ctx.plateWidthU,
      clearanceMm: ctx.clearanceMm,
      style: ctx.style,
      // The slide mouth opens through the tab's compartment-facing edge —
      // extend the cut from the pocket's far edge past the tab boundary.
      mouth: {
        sign: ctx.depthSign,
        extendMm: ctx.tabDepth - wall - pocketD + 1,
      },
    });
  } catch {
    return tabSolid;
  }
}

/**
 * Cut a swappable-label socket into `solid`'s top face, pocket centered at
 * (centerX, centerY). Shared by the label-tab shelf and the fit-calibration
 * coupon so the printed socket can never drift between the two. Throws on
 * boolean failure — callers needing best-effort semantics wrap it.
 *
 * Styles:
 * - `clickIn` (default): pocket + retention ribs, floor at topZ − pocket
 *   depth. The Cullenect-compatible profile.
 * - `slideChannel`: pocket sunk one lip band + z-clearance deeper, with
 *   overhanging lips left/right/anchor-side, a mouth corridor opening
 *   `mouth.sign`-ward through the host's edge (`mouth.extendMm` past the
 *   pocket), and a park detent on the corridor floor at the pocket edge.
 */
export function cutLabelSocket(
  scope: DisposalScope,
  solid: Shape3D,
  ctx: {
    centerX: number;
    centerY: number;
    topZ: number;
    plateWidthU: LabelPlateWidthU;
    clearanceMm: number;
    style?: LabelSocketStyle;
    mouth?: { sign: 1 | -1; extendMm: number };
  }
): Shape3D {
  const pocketW = labelPlateWidthMm(ctx.plateWidthU) + ctx.clearanceMm;
  const pocketD = LABEL_PLATE_HEIGHT_MM + ctx.clearanceMm;

  if ((ctx.style ?? 'clickIn') === 'slideChannel') {
    if (!ctx.mouth) {
      // Throwing (not falling back to click-in) keeps a future call site from
      // silently shipping the wrong retention profile; best-effort callers
      // already wrap this function.
      throw new Error('slideChannel socket requires a mouth direction');
    }
    return cutSlideChannel(
      scope,
      solid,
      { centerX: ctx.centerX, centerY: ctx.centerY, topZ: ctx.topZ, mouth: ctx.mouth },
      pocketW,
      pocketD
    );
  }

  const floorZ = ctx.topZ - LABEL_SOCKET_CLICK_POCKET_DEPTH_MM;

  const pocketCutter = scope.register(
    translate(
      scope.register(
        sketch(
          drawRoundedRectangle(pocketW, pocketD, LABEL_PLATE_CORNER_RADIUS_MM),
          'XY',
          floorZ
        ).extrude(LABEL_SOCKET_CLICK_POCKET_DEPTH_MM + COPLANAR_MARGIN)
      ),
      [ctx.centerX, ctx.centerY, 0]
    )
  );
  let result = scope.register(unwrap(cut(solid as ValidSolid, pocketCutter as ValidSolid)));

  // Ribs: full pocket-X span (square ends fuse into the rounded corners,
  // matching the standard), embedded slightly into the wall so the fuse
  // never leaves a coplanar seam.
  const ribEmbed = 0.1;
  const ribT = LABEL_SOCKET_RIB_PROTRUSION_MM + ribEmbed;
  const ribZ0 = floorZ + LABEL_SOCKET_RIB_START_MM;
  const ribProfile = draw([-pocketW / 2, -ribT / 2])
    .lineTo([pocketW / 2, -ribT / 2])
    .lineTo([pocketW / 2, ribT / 2])
    .lineTo([-pocketW / 2, ribT / 2])
    .close();
  for (const side of [-1, 1] as const) {
    const wallY = ctx.centerY + (side * pocketD) / 2;
    const ribCenterY = wallY - side * (ribT / 2 - ribEmbed);
    const rib = scope.register(
      translate(
        scope.register(sketch(ribProfile, 'XY', ribZ0).extrude(LABEL_SOCKET_RIB_HEIGHT_MM)),
        [ctx.centerX, ribCenterY, 0]
      )
    );
    result = scope.register(unwrap(fuse(result, rib as ValidSolid)));
  }
  return result;
}

/**
 * Slide-channel variant of `cutLabelSocket`: a two-layer cut (cavity below,
 * lip window above, stacked exactly like the v1 plate channels — no
 * epsilon seams) plus a fused park detent at the pocket's mouth edge.
 */
function cutSlideChannel(
  scope: DisposalScope,
  solid: Shape3D,
  ctx: {
    centerX: number;
    centerY: number;
    topZ: number;
    mouth: { sign: 1 | -1; extendMm: number };
  },
  pocketW: number,
  pocketD: number
): Shape3D {
  const r = LABEL_PLATE_CORNER_RADIUS_MM;
  const lipT = LABEL_SOCKET_LIP_THICKNESS_MM;
  const overhang = LABEL_SOCKET_LIP_OVERHANG_MM;
  const cavityTop = ctx.topZ - lipT;
  const floorZ = cavityTop - LABEL_SOCKET_SLIDE_Z_CLEARANCE_MM - LABEL_SOCKET_POCKET_DEPTH_MM;
  const { sign, extendMm } = ctx.mouth;

  // Cavity: pocket + mouth corridor at full plate width, up to the lip
  // underside.
  const cavityD = pocketD + extendMm;
  const cavity = scope.register(
    translate(
      scope.register(
        sketch(drawRoundedRectangle(pocketW, cavityD, r), 'XY', floorZ).extrude(cavityTop - floorZ)
      ),
      [ctx.centerX, ctx.centerY + (sign * extendMm) / 2, 0]
    )
  );
  let result = scope.register(unwrap(cut(solid as ValidSolid, cavity as ValidSolid)));

  // Lip window: inset by the overhang on the two side walls and the
  // anchor-side wall; open through the mouth. Cut from the cavity top up
  // past the shelf top.
  const windowW = pocketW - 2 * overhang;
  const windowD = pocketD - overhang + extendMm;
  const window = scope.register(
    translate(
      scope.register(
        sketch(drawRoundedRectangle(windowW, windowD, r), 'XY', cavityTop).extrude(lipT + 1)
      ),
      [ctx.centerX, ctx.centerY + (sign * (overhang + extendMm)) / 2, 0]
    )
  );
  result = scope.register(unwrap(cut(result, window as ValidSolid)));

  // Park detent: a low bar across the corridor floor just past the pocket
  // edge — the plate rides over it on the way in and rests behind it.
  const detentW = windowW;
  const detentCenterY = ctx.centerY + sign * (pocketD / 2 + LABEL_SOCKET_DETENT_DEPTH_MM / 2);
  const detent = scope.register(
    translate(
      scope.register(
        sketch(
          drawRoundedRectangle(detentW, LABEL_SOCKET_DETENT_DEPTH_MM, 0.2),
          'XY',
          floorZ
        ).extrude(LABEL_SOCKET_DETENT_HEIGHT_MM)
      ),
      [ctx.centerX, detentCenterY, 0]
    )
  );
  result = scope.register(unwrap(fuse(result, detent as ValidSolid)));
  return result;
}
