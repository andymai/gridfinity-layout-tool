/**
 * Face provenance collector.
 *
 * Uses a fast low-fidelity mesh to discover which BREP face origins
 * belong to a given feature, recording them in the originToTag map.
 */

import { mesh } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { FeatureTag } from '../featureTags';

/**
 * Collect face origin IDs from a shape using a fast low-fidelity mesh.
 * Maps each unique origin to the given FeatureTag.
 */
export function collectOrigins(shape: Shape3D, tag: FeatureTag, map: Map<number, number>): void {
  const m = mesh(shape, { tolerance: 5, angularTolerance: 45 });
  for (const fg of m.faceGroups) {
    const origin = (fg as { origin?: number }).origin;
    if (origin !== undefined && !map.has(origin)) {
      map.set(origin, tag);
    }
  }
}
