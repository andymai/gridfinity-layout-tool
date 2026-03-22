/**
 * Hydrates ParsedCutoutSpec into a full Cutout object.
 *
 * Pure function — assigns IDs, cutDepth, and default values
 * to the intermediate spec produced by svgParser.
 */

import type { Cutout } from '@/features/bin-designer/types';
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
    return { ...base, path: spec.path };
  }

  return base;
}
