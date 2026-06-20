/**
 * Resolve a raycast-hit triangle index to the ColorZone painting it.
 *
 * The multi-color path (`buildMultiColorGroups`) already classifies every
 * rendered triangle into a zone (`triZones`) — including the split lip
 * cells — so hit-testing is a direct array lookup rather than a second,
 * possibly-divergent centroid classification. Building from `triZones`
 * guarantees the picker, preview coloring, and 3MF export agree.
 */

import type { ColorZone } from '../types/featureColors';

export interface ZoneResolver {
  resolve(triangleIndex: number): ColorZone;
}

/**
 * Build a resolver over the per-rendered-triangle zone array produced by
 * `buildMultiColorGroups`. Out-of-range indices fall back to body.
 */
export function buildZoneResolver(triZones: readonly ColorZone[]): ZoneResolver {
  return {
    resolve(triangleIndex: number): ColorZone {
      return triZones[triangleIndex] ?? 'body';
    },
  };
}
