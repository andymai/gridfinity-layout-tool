/**
 * Connector fit-sample tray ("calibration card").
 *
 * A single printable tray that lets makers dial in their connector fit before
 * committing to a full split baseplate. Laid out as a grid:
 *
 *   rows  = the three connector styles (dovetail / dovetailKey / snapClip)
 *   cols  = a fit-offset ladder (-0.10 … +0.10 mm, centered on nominal)
 *
 * Each grid cell is a MATED PAIR of small abstract coupons carrying the real
 * connector profile (reused verbatim from `baseplateConnectors` so the printed
 * fit matches the real plate — the tolerance lives in the female groove/pocket,
 * not the surrounding socket, which is why a plain block coupon fits identically
 * to a full 42 mm cell). Both halves of every pair are embossed with their
 * style + offset so detached pieces stay identifiable.
 *
 * The dovetail KEY and snap CLIP are nominal parts — the offset rides entirely
 * on the female pocket — so each of those rows ships ONE shared loose part the
 * maker inserts into each offset's pair to feel the fit, rather than five
 * redundant copies.
 *
 * Pieces are separate, non-fused solids resting on the bed (Z≥0); the export
 * compounds them into one ready-to-slice file.
 */

import {
  draw,
  fuse,
  cut,
  cutAll,
  translate,
  compound,
  mesh,
  exportSTEP,
  unwrap,
  withScope,
  clone,
} from 'brepjs';
import type { Shape3D, ValidSolid, Drawing, DisposalScope } from 'brepjs';
import type { BaseplateParams } from '@/shared/types/bin';
import type { ExportFormat } from '../../bridge/types';
import { sketch } from './meshUtils';
import {
  SOCKET_HEIGHT,
  MAGNET_FLOOR,
  COPLANAR_MARGIN,
  TONGUE_PROTRUSION,
  TONGUE_BASE_HALF,
  TONGUE_TIP_HALF,
  TONGUE_CLEARANCE,
  DOVETAIL_KEY_CLEARANCE,
  effectiveClearance,
} from './generatorTypes';
import { snapClipLevels } from '@/shared/constants/connectors';
import type { SnapClipLevels } from '@/shared/constants/connectors';
import {
  makeTongue,
  makeGroove,
  makeSnapPocket,
  buildDovetailKey,
  buildSnapClipForPrint,
} from './baseplateConnectors';
import { buildTextSolid } from './textBuilder';
import { buildBaseplateSTL } from './baseplateSTL';

/** Fit-offset ladder swept across the columns, centered on nominal (0). */
const SAMPLE_OFFSETS: readonly number[] = [-0.1, -0.05, 0, 0.05, 0.1];

interface SampleStyle {
  readonly key: 'dovetail' | 'dovetailKey' | 'snapClip';
  /** Short label prefix embossed on each coupon (e.g. "DT"). */
  readonly abbr: string;
  /** Whether the row ships a shared loose part (key/clip). */
  readonly loose: 'key' | 'clip' | null;
}

const SAMPLE_STYLES: readonly SampleStyle[] = [
  { key: 'dovetail', abbr: 'DT', loose: null },
  { key: 'dovetailKey', abbr: 'DK', loose: 'key' },
  { key: 'snapClip', abbr: 'SC', loose: 'clip' },
];

// Tray layout (mm). A coupon's long axis is X so the embossed label reads
// left-to-right; the seam runs along X, so a pair stacks front/back along Y.
const COUPON_X = 15; // coupon length (label axis)
const COUPON_Y = 9; // coupon depth (across the seam)
const COUPON_FILLET = 1.4; // rounded top-view corners — finished look, broken edges
const SEAM_GAP = 5; // gap between the two coupons of a pair (printed separated)
const COL_GAP = 7; // gap between offset columns
const ROW_GAP = 10; // gap between style rows
const LABEL_DEPTH = 0.6; // emboss height above the top face
const LABEL_MARGIN = 1.4;
const LABEL_MIN_FONT = 1.0;
const LABEL_MAX_FONT = 2.4;

const CELL_Y = 2 * COUPON_Y + SEAM_GAP; // total Y footprint of one mated pair
const COL_PITCH = COUPON_X + COL_GAP;
const ROW_PITCH = CELL_Y + ROW_GAP;

/** Map (wall, boundary) → XY point for a seam running along X (protrude on Y). */
function ptY(wall: number, bp: number): [number, number] {
  return [bp, wall];
}

/** Signed fit-offset label, e.g. "+0.05", "-0.10", "0.00". */
function formatOffset(v: number): string {
  const s = v.toFixed(2);
  return v > 0 ? `+${s}` : s;
}

/** Rounded-rectangle top-view profile centered at (cx, cy). */
function roundedRect(cx: number, cy: number, w: number, h: number, r: number): Drawing {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  return draw([cx, y0])
    .lineTo([x1, y0])
    .customCorner(r)
    .lineTo([x1, y1])
    .customCorner(r)
    .lineTo([x0, y1])
    .customCorner(r)
    .lineTo([x0, y0])
    .customCorner(r)
    .close();
}

type CouponFeature =
  | { readonly kind: 'tongue' }
  | { readonly kind: 'groove'; readonly clearance: number }
  | { readonly kind: 'pocket'; readonly levels: SnapClipLevels };

/**
 * Build one labeled coupon at tray position (cx, cy): a rounded slab carrying
 * the connector feature on its seam-facing wall, embossed with `label`. Built
 * in the pre-lift frame (top at Z=0, bottom at -totalHeight); the caller lifts
 * the whole tray onto the bed.
 */
function buildCoupon(
  cx: number,
  cy: number,
  totalHeight: number,
  label: string,
  wallY: number,
  d: -1 | 1,
  feature: CouponFeature
): Shape3D {
  return withScope((scope: DisposalScope): Shape3D => {
    let solid: Shape3D = scope.register(
      sketch(roundedRect(cx, cy, COUPON_X, COUPON_Y, COUPON_FILLET), 'XY', 0).extrude(-totalHeight)
    );

    switch (feature.kind) {
      case 'tongue': {
        const tongue = scope.register(
          makeTongue(
            ptY,
            wallY,
            cx,
            d,
            TONGUE_PROTRUSION,
            TONGUE_BASE_HALF,
            TONGUE_TIP_HALF,
            totalHeight
          )
        );
        solid = scope.register(unwrap(fuse(solid as ValidSolid, tongue as ValidSolid)));
        break;
      }
      case 'groove': {
        const groove = scope.register(
          makeGroove(
            ptY,
            wallY,
            cx,
            d,
            TONGUE_PROTRUSION,
            TONGUE_BASE_HALF,
            TONGUE_TIP_HALF,
            feature.clearance,
            COPLANAR_MARGIN,
            totalHeight
          )
        );
        solid = scope.register(unwrap(cut(solid as ValidSolid, groove as ValidSolid)));
        break;
      }
      case 'pocket': {
        const cutters = makeSnapPocket(ptY, wallY, cx, d, feature.levels).map((c) =>
          scope.register(c)
        );
        solid = scope.register(unwrap(cutAll(solid as ValidSolid, cutters as ValidSolid[])));
        break;
      }
    }

    // Emboss the style+offset on the top face (raised letters). Degrades to an
    // unlabeled coupon if the font isn't loaded or auto-fit can't satisfy the
    // floor — a single label must never tank the whole tray.
    const text = buildTextSolid(scope, {
      text: label,
      fontFamily: 'jetbrains-mono',
      mode: 'emboss',
      availW: COUPON_X,
      availD: COUPON_Y,
      centerX: cx,
      centerY: cy,
      topZ: 0,
      depth: LABEL_DEPTH,
      hostThickness: totalHeight,
      margin: LABEL_MARGIN,
      minFontSize: LABEL_MIN_FONT,
      maxFontSize: LABEL_MAX_FONT,
    });
    if (text) {
      try {
        solid = scope.register(unwrap(fuse(solid as ValidSolid, text.solid as ValidSolid)));
      } catch {
        // keep the unlabeled coupon
      }
    }

    return unwrap(clone(solid));
  });
}

/**
 * Build all fit-sample pieces as separate, bed-resting solids. Caller owns the
 * returned shapes (frees them after compounding).
 */
export function buildConnectorSampleTray(params: BaseplateParams): Shape3D[] {
  const floorDepth = params.magnetHoles ? MAGNET_FLOOR + params.magnetDepth : 0;
  const totalHeight = SOCKET_HEIGHT + floorDepth;
  const gridUnitMm = params.gridUnitMm;

  const nRows = SAMPLE_STYLES.length;
  const nCols = SAMPLE_OFFSETS.length;
  // Center the grid on the origin (columns 0..nCols include the loose column).
  const originX = -(nCols * COL_PITCH) / 2;
  const originY = ((nRows - 1) * ROW_PITCH) / 2;

  const pieces: Shape3D[] = [];

  SAMPLE_STYLES.forEach((style, r) => {
    const cellY = originY - r * ROW_PITCH;
    const frontWallY = cellY - SEAM_GAP / 2; // +Y face of the front coupon
    const backWallY = cellY + SEAM_GAP / 2; // -Y face of the back coupon
    const frontCenterY = cellY - SEAM_GAP / 2 - COUPON_Y / 2;
    const backCenterY = cellY + SEAM_GAP / 2 + COUPON_Y / 2;

    SAMPLE_OFFSETS.forEach((offset, c) => {
      const cx = originX + c * COL_PITCH;
      const label = `${style.abbr} ${formatOffset(offset)}`;

      let frontFeature: CouponFeature;
      let backFeature: CouponFeature;
      if (style.key === 'snapClip') {
        const levels = snapClipLevels(totalHeight, offset);
        frontFeature = { kind: 'pocket', levels };
        backFeature = { kind: 'pocket', levels };
      } else if (style.key === 'dovetailKey') {
        const clearance = effectiveClearance(DOVETAIL_KEY_CLEARANCE, offset);
        frontFeature = { kind: 'groove', clearance };
        backFeature = { kind: 'groove', clearance };
      } else {
        // Integral dovetail: nominal tongue, offset rides on the female groove.
        frontFeature = { kind: 'tongue' };
        backFeature = { kind: 'groove', clearance: effectiveClearance(TONGUE_CLEARANCE, offset) };
      }

      pieces.push(buildCoupon(cx, frontCenterY, totalHeight, label, frontWallY, 1, frontFeature));
      pieces.push(buildCoupon(cx, backCenterY, totalHeight, label, backWallY, -1, backFeature));
    });

    // One shared loose part per key/clip row, placed in the column beyond the
    // ladder. Built at nominal size (the offset is in the pocket), shifted down
    // into the pre-lift frame so it rests on the bed after the global lift.
    if (style.loose) {
      const looseX = originX + nCols * COL_PITCH;
      const part =
        style.loose === 'clip'
          ? buildSnapClipForPrint(totalHeight, gridUnitMm)
          : buildDovetailKey(totalHeight);
      const placed = translate(part, [looseX, cellY, -totalHeight]);
      part.delete();
      pieces.push(placed);
    }
  });

  return pieces;
}

/** Export the connector fit-sample tray as a single STL or STEP file. */
export async function exportConnectorSample(
  params: BaseplateParams,
  format: ExportFormat,
  tolerance?: number,
  angularTolerance?: number
): Promise<{ data: ArrayBuffer; fileName: string }> {
  const floorDepth = params.magnetHoles ? MAGNET_FLOOR + params.magnetDepth : 0;
  const totalHeight = SOCKET_HEIGHT + floorDepth;

  const pieces = buildConnectorSampleTray(params);
  const tray = compound(pieces);
  for (const p of pieces) p.delete();
  // Lift the whole tray so every piece rests on the bed (Z≥0).
  const lifted = translate(tray, [0, 0, totalHeight]);
  tray.delete();

  try {
    const name = 'connector_fit_sample';
    if (format === 'step') {
      const blob = unwrap(exportSTEP(lifted));
      const data = await blob.arrayBuffer();
      return { data, fileName: `${name}.step` };
    }
    const tol = tolerance ?? 0.01;
    const angTol = angularTolerance ?? 5;
    const meshResult = mesh(lifted, { tolerance: tol, angularTolerance: angTol });
    const data = buildBaseplateSTL(meshResult, name);
    return { data, fileName: `${name}.stl` };
  } finally {
    lifted.delete();
  }
}
