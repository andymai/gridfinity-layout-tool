/**
 * Scale a ParsedCutoutSpec by a uniform factor (user units → mm).
 *
 * Applied at the tail of `parseSvgString` when the SVG declares physical
 * width/height (e.g. `width="100mm"`) so a `<rect width="80">` inside a
 * `viewBox="0 0 800 800"` resolves to a 10mm cutout instead of 80mm.
 *
 * Path point coordinates are scaled in place; bezier handle deltas are
 * scaled as well so the curve shape is preserved at the new size.
 */

import type { PathPoint } from '@/features/bin-designer/types';
import type { ParsedCutoutSpec } from './types';

export function scaleParsedSpec(spec: ParsedCutoutSpec, scale: number): ParsedCutoutSpec {
  if (scale === 1) return spec;

  const base = {
    ...spec,
    x: spec.x * scale,
    y: spec.y * scale,
    width: spec.width * scale,
    depth: spec.depth * scale,
    cornerRadius: spec.cornerRadius * scale,
  };

  if (spec.path) {
    return { ...base, path: spec.path.map((pt) => scalePathPoint(pt, scale)) };
  }

  return base;
}

function scalePathPoint(pt: PathPoint, scale: number): PathPoint {
  return {
    ...pt,
    x: pt.x * scale,
    y: pt.y * scale,
    handleIn: pt.handleIn ? { dx: pt.handleIn.dx * scale, dy: pt.handleIn.dy * scale } : null,
    handleOut: pt.handleOut ? { dx: pt.handleOut.dx * scale, dy: pt.handleOut.dy * scale } : null,
  };
}
