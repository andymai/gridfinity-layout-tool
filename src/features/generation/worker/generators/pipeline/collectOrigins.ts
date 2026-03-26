/**
 * Face provenance collector.
 *
 * Uses a fast low-fidelity mesh to discover which BREP face origins
 * belong to a given feature, recording them in the originToTag map.
 *
 * Uses "last writer wins" — features that run later (lip, label tab)
 * override the base body tag on shared/fused faces. This ensures
 * feature-specific colors take priority over the generic body color.
 */

import { mesh } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { FeatureTag } from '../featureTags';

/** Whether we've already logged the missing-origin warning this session. */
let originWarningLogged = false;

/**
 * Collect face origin IDs from a shape using a fast low-fidelity mesh.
 * Maps each unique origin to the given FeatureTag (overwrites existing tags).
 */
export function collectOrigins(shape: Shape3D, tag: FeatureTag, map: Map<number, number>): void {
  const m = mesh(shape, { tolerance: 5, angularTolerance: 45 });

  for (const fg of m.faceGroups) {
    const origin = (fg as { origin?: number }).origin;

    if (origin === undefined) {
      // Runtime guard: brepjs API may change and stop exposing origin field
      if (!originWarningLogged) {
        // eslint-disable-next-line no-console -- one-time diagnostic warning
        console.warn(
          '[collectOrigins] face group missing origin field — color tagging may be incorrect'
        );
        originWarningLogged = true;
      }
      continue;
    }

    // Last writer wins: feature tags override base/shell tags
    map.set(origin, tag);
  }
}
