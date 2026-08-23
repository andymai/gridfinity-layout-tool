/**
 * Turns a parsed scan/SVG spec into a Workshop cutter profile. The scan
 * pipeline delivers mm-scaled specs (bezier path for traced tools,
 * parametric shapes for recognized primitives); anything that cannot map to
 * a valid profile returns null and the caller reports it unconsumed.
 */
import type { CutterProfile } from '@/shared/types/assembly';
import type { ParsedCutoutSpec } from '../panel/CutoutsSection/svgImport/types';

const MAX_PATH_POINTS = 2000;

export function specToCutterProfile(spec: ParsedCutoutSpec): CutterProfile | null {
  switch (spec.shape) {
    case 'path':
      if (!spec.path || spec.path.length < 2 || spec.path.length > MAX_PATH_POINTS) return null;
      return { shape: 'path', points: [...spec.path] };
    case 'circle':
      return spec.width > 0 ? { shape: 'circle', diameter: spec.width } : null;
    case 'rectangle':
      if (spec.width <= 0 || spec.depth <= 0) return null;
      return {
        shape: 'rectangle',
        width: spec.width,
        depth: spec.depth,
        cornerRadius: Math.max(0, spec.cornerRadius),
      };
    case 'slot':
      if (spec.width <= 0 || spec.depth <= 0) return null;
      return { shape: 'slot', length: spec.width, width: spec.depth };
    default:
      return null;
  }
}
