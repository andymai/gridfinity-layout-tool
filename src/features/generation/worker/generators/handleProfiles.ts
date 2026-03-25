/**
 * Handle cutout profile builders.
 *
 * Pure 2D geometry: each function returns a Drawing (2D sketch) for a handle shape.
 * Profiles are centered at the origin (X = horizontal, Y = vertical).
 *
 * - rectangle: rounded rectangle (existing behavior, now explicit)
 * - oval: true ellipse via brepjs drawEllipse
 * - scoop: semicircle / circular arc (closed hole)
 * - u-shape: open at bottom — extends below origin for clean boolean cut
 */

import { draw, drawRoundedRectangle, drawRectangle, drawEllipse } from 'brepjs';
import type { Drawing } from 'brepjs';
import type { HandleCutoutShape } from '@/shared/types/bin';
import { U_SHAPE_OVERSHOOT } from '@/shared/utils/handleCutoutClip';

interface ProfileArgs {
  /** Horizontal span in mm */
  readonly width: number;
  /** Vertical extent in mm */
  readonly height: number;
  /** Corner radius in mm (used for rectangle and u-shape) */
  readonly cornerRadius: number;
}

/**
 * Build a 2D handle cutout profile for the given shape.
 *
 * Returns null if dimensions are too small to produce geometry.
 */
export function buildHandleProfile(shape: HandleCutoutShape, args: ProfileArgs): Drawing | null {
  const { width, height, cornerRadius } = args;
  if (width < 0.1 || height < 0.1) return null;

  switch (shape) {
    case 'oval':
      return buildOvalProfile(width, height);
    case 'scoop':
      return buildScoopProfile(width, height);
    case 'u-shape':
      return buildUShapeProfile(width, height, cornerRadius);
    default:
      return buildRectangleProfile(width, height, cornerRadius);
  }
}

function buildRectangleProfile(w: number, h: number, r: number): Drawing {
  const safeR = Math.max(0, Math.min(r, w / 2 - 0.01, h / 2 - 0.01));
  return safeR > 0.1 ? drawRoundedRectangle(w, h, safeR) : drawRectangle(w, h);
}

function buildOvalProfile(w: number, h: number): Drawing {
  return drawEllipse(w / 2, h / 2);
}

function buildScoopProfile(w: number, h: number): Drawing {
  // Closed semicircle hole: flat top + arc bottom.
  // Arc sagitta clamped to available half-height.
  const hw = w / 2;
  const hh = h / 2;
  const sagitta = Math.min(hw, hh);
  return draw([-hw, hh]).lineTo([hw, hh]).lineTo([hw, 0]).sagittaArc(-w, 0, sagitta).close();
}

function buildUShapeProfile(w: number, h: number, r: number): Drawing {
  // Open-bottom U: extends below origin by U_SHAPE_OVERSHOOT for clean boolean.
  // Rounded top corners, straight sides, open (below floor) bottom.
  const hw = w / 2;
  const totalH = h + U_SHAPE_OVERSHOOT;
  const topY = totalH / 2;
  const bottomY = -totalH / 2;
  const safeR = Math.max(0, Math.min(r, w / 2 - 0.01, h / 4 - 0.01));

  if (safeR > 0.1) {
    return draw([-hw, bottomY])
      .lineTo([-hw, topY - safeR])
      .customCorner(safeR)
      .lineTo([hw - safeR, topY])
      .customCorner(safeR)
      .lineTo([hw, bottomY])
      .close();
  }

  // Shift center to account for asymmetric overshoot
  return drawRectangle(w, totalH);
}
