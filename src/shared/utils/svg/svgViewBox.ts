/**
 * viewBox resolution and the user-unit → mm scale an `<svg>` root implies.
 *
 * Shared by every SVG importer: a file measured in CAD has to land at the same
 * real size whether it becomes a cutout or a drawer perimeter.
 */

import type { ViewBox } from './types';
import { parseSvgLengthMm } from './svgLength';

/**
 * Genuinely non-square SVGs (e.g. width="200mm" height="100mm" with a 200×200
 * viewBox) fall back to identity: one uniform scalar cannot honor non-uniform
 * stretching without distorting circles and rotated shapes.
 */
const NON_SQUARE_TOLERANCE = 0.005;

export function parseViewBox(svg: SVGSVGElement): {
  viewBox: ViewBox;
  hasExplicitViewBox: boolean;
} {
  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const parts = vb
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (
      parts.length === 4 &&
      parts.every((n) => Number.isFinite(n)) &&
      parts[2] > 0 &&
      parts[3] > 0
    ) {
      return {
        viewBox: { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] },
        hasExplicitViewBox: true,
      };
    }
  }

  // The fallback drops unit suffixes (parseFloat("1in") → 1), so it is not a
  // valid basis for physical-unit scaling — callers must guard with
  // hasExplicitViewBox before computing user-unit-to-mm scale.
  const w = parseFloat(svg.getAttribute('width') ?? '0');
  const h = parseFloat(svg.getAttribute('height') ?? '0');
  return {
    viewBox: { minX: 0, minY: 0, width: w || 100, height: h || 100 },
    hasExplicitViewBox: false,
  };
}

/**
 * Compute the user-unit → mm scale factor.
 *
 * Returns 1 (identity) unless the SVG declares physical dimensions in real
 * units (mm, cm, in, pt, pc, Q). Without explicit units, user-units are
 * treated as 1mm — preserving the import behavior callers historically relied on.
 */
export function resolveUserUnitToMm(svg: SVGSVGElement, viewBox: ViewBox): number {
  const physicalWidth = parseSvgLengthMm(svg.getAttribute('width'));
  const physicalHeight = parseSvgLengthMm(svg.getAttribute('height'));
  if (physicalWidth === null || physicalHeight === null) return 1;

  const sx = physicalWidth / viewBox.width;
  const sy = physicalHeight / viewBox.height;
  if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx <= 0 || sy <= 0) return 1;

  if (Math.abs(sx - sy) / Math.max(sx, sy) > NON_SQUARE_TOLERANCE) return 1;
  return (sx + sy) / 2;
}
