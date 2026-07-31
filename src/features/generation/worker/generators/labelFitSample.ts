/**
 * Swappable-label socket fit-calibration coupon (#2666 follow-up).
 *
 * One small printable card that sweeps the label-socket clearance across a
 * fit-offset ladder so makers can dial in `plateFitOffset` for their printer
 * before cutting sockets into real bins: five 1U-socket coupons (offsets
 * −0.10 … +0.10 mm around the nominal total clearance), each embossed with
 * its offset, plus one nominal blank 1U plate to click into each socket.
 * The winning coupon's label is the value to type into the fit-offset field.
 *
 * The offset label is sized so its thinnest glyph stem stays at least one nozzle
 * bead wide (`minPrintableLabelFontMm`), and the front strip holding it grows to
 * match — otherwise the label slices away to nothing on a 0.4mm nozzle and the
 * card can't be read (issue #3019).
 *
 * Coupons are cut with `cutLabelSocket` — the exact geometry the label-tab
 * shelf gets — at the real shelf thickness, so the printed fit transfers
 * 1:1 to bins. The offsets are absolute (the ladder is NOT centered on the
 * design's current fit offset), matching how the field is entered.
 *
 * The nominal clearance the ladder sweeps around scales with the caller's
 * live nozzle (`nozzleSizeMm`), exactly as real sockets do (#2690), so the
 * winning offset a maker records on a wide-nozzle print transfers to their
 * bins printed on that same nozzle. Undefined = the 0.4mm baseline.
 *
 * Export mirrors `connectorSample.ts`: pieces → compound → one
 * ready-to-slice STL/STEP.
 */

import { fuse, compound, mesh, exportSTEP, translate, unwrap, withScope, clone } from 'brepjs';
import type { Shape3D, ValidSolid, DisposalScope } from 'brepjs';
import {
  LABEL_PLATE_HEIGHT_MM,
  LABEL_SOCKET_SHELF_THICKNESS_MM,
  LABEL_SOCKET_WALL_MM,
  effectiveLabelSocketClearance,
  labelPlateWidthMm,
} from '@/shared/constants/labelPlates';
import type { TextStyleDefaults } from '@/shared/types/bin';
import type { ExportFormat } from '../../bridge/types';
import { sketch } from './meshUtils';
import { roundedRect, minPrintableLabelFontMm, JBM_DIGIT_INK_PER_FONT } from './couponHelpers';
import { buildTextSolid } from './textBuilder';
import { buildBaseplateSTL } from './baseplateSTL';
import { cutLabelSocket } from './labelTabBuilder';
import { buildLabelPlate } from './labelPlateBuilder';

/** Fit-offset ladder swept across the coupons, centered on nominal (0). */
export const LABEL_FIT_SAMPLE_OFFSETS: readonly number[] = [-0.1, -0.05, 0, 0.05, 0.1];

// Card layout (mm). Coupons stack in one column; the loose reference plate
// sits beside the column at mid-height.
const COUPON_W = 42;
const COUPON_D = 20;
const COUPON_FILLET = 2;
const ROW_GAP = 4;
const ROW_PITCH = COUPON_D + ROW_GAP;
const PLATE_GAP = 8;

const LABEL_DEPTH = 0.6;
/** Minimum front-strip depth for the label band (mm); grows with the nozzle so a
 *  bigger printable font still fits between the front wall and the socket. */
const LABEL_ZONE_D_MIN = 4.4;
const LABEL_MARGIN_X = 2;
/** Band headroom past the glyph ink so the pinned font clears the fit epsilon (mm). */
const LABEL_FIT_SLACK = 0.4;

/** The reference plate carries no text; the defaults only satisfy the type. */
const PLATE_TEXT_DEFAULTS: TextStyleDefaults = {
  font: 'jetbrains-mono',
  mode: 'emboss',
  depth: 0.4,
  margin: 1,
  minFontSize: 1,
  maxFontSize: 3,
};

/**
 * Signed fit-offset label, e.g. "+0.05", "-0.10", "+0.00". Zero keeps its
 * sign so every label has the same glyph count — the embossed text then adds
 * near-identical volume to each coupon (monospace font), which keeps coupon
 * volumes strictly ordered by pocket size (asserted in the scenario test).
 */
function formatOffset(v: number): string {
  const s = v.toFixed(2);
  return v >= 0 ? `+${s}` : s;
}

/**
 * Build one coupon at card position (0, cy): a shelf-thickness slab carrying
 * a full 1U socket at the given fit offset, embossed with the offset value
 * on the strip in front of the socket. The socket cut is required (a card
 * without sockets is useless); the label degrades best-effort.
 */
function buildCoupon(cy: number, offset: number, nozzleSizeMm: number | undefined): Shape3D {
  return withScope((scope: DisposalScope): Shape3D => {
    const t = LABEL_SOCKET_SHELF_THICKNESS_MM;
    const clearanceMm = effectiveLabelSocketClearance(nozzleSizeMm, offset);
    const pocketD = LABEL_PLATE_HEIGHT_MM + clearanceMm;

    let solid: Shape3D = scope.register(
      sketch(roundedRect(0, cy, COUPON_W, COUPON_D, COUPON_FILLET), 'XY', 0).extrude(t)
    );

    // Socket against the back edge with the same 1mm anchor-side wall the
    // real tab keeps.
    const socketCenterY = cy + COUPON_D / 2 - LABEL_SOCKET_WALL_MM - pocketD / 2;
    solid = cutLabelSocket(scope, solid, {
      centerX: 0,
      centerY: socketCenterY,
      topZ: t,
      plateWidthU: 1,
      clearanceMm,
    });

    // Size the label so its stems clear the nozzle bead (issue #3019), pinned to
    // that size (min == max) and measured against glyph ink (`inkBox`) — the
    // digits have no descenders, so the full line box would waste the band and
    // shrink the font. The front strip grows with the font to hold it.
    const fontMm = minPrintableLabelFontMm(nozzleSizeMm);
    const bandD = Math.max(LABEL_ZONE_D_MIN, JBM_DIGIT_INK_PER_FONT * fontMm + LABEL_FIT_SLACK);
    const text = buildTextSolid(scope, {
      text: formatOffset(offset),
      fontFamily: 'jetbrains-mono',
      mode: 'emboss',
      availW: COUPON_W - 2 * LABEL_MARGIN_X,
      availD: bandD,
      centerX: 0,
      centerY: cy - COUPON_D / 2 + 1 + bandD / 2,
      topZ: t,
      depth: LABEL_DEPTH,
      hostThickness: t,
      margin: 0,
      minFontSize: fontMm,
      maxFontSize: fontMm,
      verticalFit: 'inkBox',
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
 * Build all card pieces as separate, bed-resting solids (Z≥0). Caller owns
 * the returned shapes (frees them after compounding).
 */
export function buildLabelFitSampleCard(nozzleSizeMm?: number): Shape3D[] {
  const n = LABEL_FIT_SAMPLE_OFFSETS.length;
  const originY = ((n - 1) * ROW_PITCH) / 2;

  const pieces: Shape3D[] = LABEL_FIT_SAMPLE_OFFSETS.map((offset, i) =>
    buildCoupon(originY - i * ROW_PITCH, offset, nozzleSizeMm)
  );

  // One nominal blank reference plate beside the column: the offsets ride
  // entirely in the sockets, so a single standard plate feels every fit.
  const plate = buildLabelPlate(
    { widthU: 1, text: '' },
    { textMode: 'emboss', textDepthMm: 0.4, textDefaults: PLATE_TEXT_DEFAULTS, v1Channels: true }
  );
  const plateX = COUPON_W / 2 + PLATE_GAP + labelPlateWidthMm(1) / 2;
  const placed = translate(plate, [plateX, 0, 0]);
  plate.delete();
  pieces.push(placed);

  return pieces;
}

/** Export the fit-calibration card as a single STL or STEP file. */
export async function exportLabelFitSample(
  format: ExportFormat,
  nozzleSizeMm?: number,
  tolerance?: number,
  angularTolerance?: number
): Promise<{ data: ArrayBuffer; fileName: string }> {
  const pieces = buildLabelFitSampleCard(nozzleSizeMm);
  let assembled: Shape3D;
  try {
    assembled = compound(pieces);
  } finally {
    for (const p of pieces) p.delete();
  }

  try {
    const name = 'label_fit_sample';
    if (format === 'step') {
      const blob = unwrap(exportSTEP(assembled));
      const data = await blob.arrayBuffer();
      return { data, fileName: `${name}.step` };
    }
    // Coarse deflection like the connector card: every fit-critical face is
    // planar, so the fine default only bloats rounded corners and glyphs.
    const meshResult = mesh(assembled, {
      tolerance: tolerance ?? 0.05,
      angularTolerance: angularTolerance ?? 10,
    });
    const data = buildBaseplateSTL(meshResult, name);
    return { data, fileName: `${name}.stl` };
  } finally {
    assembled.delete();
  }
}
