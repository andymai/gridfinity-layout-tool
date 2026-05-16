/**
 * Map a hit triangle (from a raycast) to the ColorZone whose material
 * paints it, using the same rules the preview and exporter follow:
 *  - FeatureTag → ColorZone for non-LIP groups
 *  - LIP triangles → one of four lip corners by centroid quadrant
 *  - Triangles outside any group fall back to `body`
 *
 * Pure function — no Three.js, no DOM. Same indices/vertices shape the
 * preview already builds, so hit-test stays geometry-format-agnostic.
 */

import { FeatureTag } from '@/shared/types/generation';
import type { FaceGroupData } from '@/shared/types/generation';
import { featureTagToColorZone, lipCornerZone } from '../types/featureColors';
import type { ColorZone } from '../types/featureColors';
import { classifyLipCorner, computeLipBBoxCenter } from './lipCornerClassifier';

/**
 * Per-mesh setup state for resolving triangle hits. The lip bbox center is
 * the expensive bit (scans every LIP triangle); pre-computing it once per
 * mesh keeps pointer-move handlers cheap.
 */
export interface ZoneResolver {
  resolve(triangleIndex: number): ColorZone;
}

/**
 * Build a resolver for the given mesh. The lip bbox is computed up front,
 * so subsequent `resolve()` calls just do a linear scan over face groups
 * (group count is small — typically under a dozen) plus O(1) for the
 * corner classification — cheap enough for per-pointer-move use even on
 * dense meshes.
 */
export function buildZoneResolver(
  faceGroups: readonly FaceGroupData[],
  vertices: Float32Array,
  indices: Uint32Array
): ZoneResolver {
  const triangleXY = (triIdx: number) => {
    const i = triIdx * 3;
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    return {
      x: (vertices[a] + vertices[b] + vertices[c]) / 3,
      y: (vertices[a + 1] + vertices[b + 1] + vertices[c + 1]) / 3,
    };
  };

  const lipCenter = computeLipBBoxCenter(faceGroups, triangleXY);

  return {
    resolve(triangleIndex: number): ColorZone {
      const indexOffset = triangleIndex * 3;
      const group = faceGroups.find(
        (g) => indexOffset >= g.start && indexOffset < g.start + g.count
      );
      if (!group) return 'body';

      if (group.tag === FeatureTag.LIP) {
        if (!lipCenter) return 'body';
        const { x, y } = triangleXY(triangleIndex);
        return lipCornerZone(classifyLipCorner(x, y, lipCenter.cx, lipCenter.cy));
      }

      return featureTagToColorZone(group.tag) ?? 'body';
    },
  };
}

/**
 * One-shot convenience wrapper for callers that don't memoize (e.g. tests).
 * Builds a fresh resolver and resolves a single triangle in one call.
 */
export function resolveTriangleZone(
  triangleIndex: number,
  faceGroups: readonly FaceGroupData[],
  vertices: Float32Array,
  indices: Uint32Array
): ColorZone {
  return buildZoneResolver(faceGroups, vertices, indices).resolve(triangleIndex);
}
