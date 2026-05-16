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
 * `triangleIndex` is the hit triangle from a raycast (0-based count, not
 * an index offset). `indices` is the BufferGeometry index buffer; the
 * triangle's three vertices are at `indices[3T..3T+2]` (each * 3 to step
 * the flat vertex buffer). When `triangleIndex` falls outside every
 * faceGroup or its group is LIP-but-no-lip-bbox, this returns `'body'`.
 */
export function resolveTriangleZone(
  triangleIndex: number,
  faceGroups: readonly FaceGroupData[],
  vertices: Float32Array,
  indices: Uint32Array
): ColorZone {
  const indexOffset = triangleIndex * 3;
  const group = faceGroups.find((g) => indexOffset >= g.start && indexOffset < g.start + g.count);
  if (!group) return 'body';

  if (group.tag === FeatureTag.LIP) {
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
    if (!lipCenter) return 'body';
    const { x, y } = triangleXY(triangleIndex);
    return lipCornerZone(classifyLipCorner(x, y, lipCenter.cx, lipCenter.cy));
  }

  return featureTagToColorZone(group.tag) ?? 'body';
}
