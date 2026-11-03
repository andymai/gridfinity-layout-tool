/**
 * Hydrates ParsedCutoutSpec into a full Cutout object.
 *
 * Pure function — assigns IDs, cutDepth, and default values
 * to the intermediate spec produced by svgParser.
 */

import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import { withoutTinyLoops } from '@/shared/utils/tinyLoops';
import { getPathBounds } from '../pathGeometry';
import type { ParsedCutoutSpec } from './types';

/** Options for hydrating a spec into a Cutout. */
export interface HydrationOptions {
  /** Cavity depth in mm (how deep the cut goes from top surface). Default: 5 */
  readonly cutDepth: number;
  /** Factory function for generating unique IDs. */
  readonly idFactory: () => string;
}

/** Default hydration options. */
export const DEFAULT_CUT_DEPTH = 5;

/** Loops smaller than this (mm²) are folds or rounding, never a part of the shape. */
const TINY_LOOP_MM2 = 0.5;

/** A straight-edged ring without the tiny loops a trace or its rounding can leave. */
function untangled(ring: readonly PathPoint[]): PathPoint[] {
  if (ring.some((p) => p.handleIn || p.handleOut)) return [...ring];
  return withoutTinyLoops(ring, TINY_LOOP_MM2, (x, y) => ({
    x,
    y,
    handleIn: null,
    handleOut: null,
    symmetric: false,
  }));
}

/**
 * Convert a ParsedCutoutSpec to a full Cutout with store-ready fields.
 *
 * @param spec - Intermediate shape spec from SVG parser
 * @param options - Hydration options (cutDepth, idFactory)
 * @returns Fully-formed Cutout object ready for the store
 */
export function specToCutout(spec: ParsedCutoutSpec, options: HydrationOptions): Cutout {
  const base: Cutout = {
    id: options.idFactory(),
    shape: spec.shape,
    x: spec.x,
    y: spec.y,
    width: spec.width,
    depth: spec.depth,
    cutDepth: options.cutDepth,
    rotation: spec.rotation,
    cornerRadius: spec.cornerRadius,
    label: '',
    groupId: null,
  };

  if (spec.shape === 'path' && spec.path) {
    const path = untangled(spec.path);
    // A cut loop can hold the outline's extreme point, and the cutout turns
    // about the middle of its box.
    const cut = path.length !== spec.path.length || path.some((p, i) => p !== spec.path?.[i]);
    const { minX, minY, maxX, maxY } = getPathBounds(path);
    return {
      ...base,
      ...(cut ? { x: minX, y: minY, width: maxX - minX, depth: maxY - minY } : {}),
      path,
      ...(spec.holes ? { holes: spec.holes.map(untangled) } : {}),
    };
  }

  return base;
}
