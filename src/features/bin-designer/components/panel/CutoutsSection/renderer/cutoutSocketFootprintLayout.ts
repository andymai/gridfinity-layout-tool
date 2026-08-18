/**
 * Layout math for the plate footprint drawn on the 2D editor surface.
 *
 * Pure and separate from the component for the reason `cutoutLabelFit` is: an
 * R3F component cannot be rendered in jsdom, so anything worth asserting has
 * to live where a test can reach it.
 *
 * The caption size here is an approximation (the printed plate measures real
 * glyph metrics through the kernel), so this answers "does a plate of this size
 * sit here, and roughly what does it say", not "this is the printed layout".
 */

import * as THREE from 'three';

/** Margin inside the plate the caption keeps clear (mm), per side. */
export const TEXT_MARGIN_MM = 1.5;
/** Band the icon takes when one is set (mm), and its gap to the caption. */
export const ICON_BAND_MM = 7;
export const ICON_GAP_MM = 1;
/** Caption height budget inside the plate (mm). */
export const TEXT_BAND_MM = 7;
/** Rough glyph aspect: advance width as a fraction of font size. */
const GLYPH_ADVANCE_RATIO = 0.6;

export interface SocketCaptionLayout {
  /** 0 when there is nothing to draw. */
  readonly fontSize: number;
  /** Width the caption may occupy (mm). */
  readonly captionSpan: number;
  /** Caption centre along the plate's long axis, from the plate centre (mm). */
  readonly captionCenter: number;
  /** Icon centre along the same axis; meaningless when no icon is set. */
  readonly iconCenter: number;
}

/**
 * Divide the plate's readable band between the icon and the caption, mirroring
 * how the printed plate splits the same span: icon at the leading end, caption
 * centred in what is left.
 */
export function socketCaptionLayout(
  plateLengthMm: number,
  hasIcon: boolean,
  text: string
): SocketCaptionLayout {
  const iconSpan = hasIcon ? ICON_BAND_MM + ICON_GAP_MM : 0;
  const captionSpan = Math.max(0, plateLengthMm - 2 * TEXT_MARGIN_MM - iconSpan);
  const trimmed = text.trim();
  const fontSize =
    trimmed === '' || captionSpan === 0
      ? 0
      : Math.min(TEXT_BAND_MM, captionSpan / Math.max(1, trimmed.length * GLYPH_ADVANCE_RATIO));

  const iconCenter = -plateLengthMm / 2 + TEXT_MARGIN_MM + ICON_BAND_MM / 2;
  const captionCenter = hasIcon ? iconCenter + ICON_BAND_MM / 2 + ICON_GAP_MM + captionSpan / 2 : 0;

  return { fontSize, captionSpan, captionCenter, iconCenter };
}

/** Rounded rectangle centred on the origin, as a fillable Three shape. */
export function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  const x = w / 2;
  const y = h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-x + radius, -y);
  shape.lineTo(x - radius, -y);
  shape.quadraticCurveTo(x, -y, x, -y + radius);
  shape.lineTo(x, y - radius);
  shape.quadraticCurveTo(x, y, x - radius, y);
  shape.lineTo(-x + radius, y);
  shape.quadraticCurveTo(-x, y, -x, y - radius);
  shape.lineTo(-x, -y + radius);
  shape.quadraticCurveTo(-x, -y, -x + radius, -y);
  return shape;
}
