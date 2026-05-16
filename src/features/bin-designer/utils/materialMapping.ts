/**
 * Material mapping for multi-color 3MF export.
 *
 * Walks the face groups, maps each tagged region to a ColorZone, and
 * resolves the per-zone hex into a material index. LIP triangles are
 * subdivided by corner via centroid quadrant — see lipCornerClassifier.
 */

import { FeatureTag } from '@/shared/types/generation';
import type { FaceGroupData } from '@/shared/types/generation';
import type { ThreeMFColorConfig } from '@/shared/generation/export';
import {
  featureTagToColorZone,
  getZoneColor,
  isSingleColor,
  lipCornerZone,
  resolveColorMapping,
} from '../types/featureColors';
import type { ColorZone, FeatureColorConfig } from '../types/featureColors';
import { classifyLipCorner, computeLipBBoxCenter } from './lipCornerClassifier';

/**
 * Builds a per-triangle material index array from face groups and color
 * assignments.
 *
 * `vertices` is the flat STL-style vertex array (9 floats per triangle).
 * It's only used to compute centroids for LIP triangles when the four
 * corners have different colors; non-lip pipelines never read it.
 *
 * Returns null when the design is single-color (no basematerials section
 * needed in the 3MF).
 */
export function buildTriangleMaterialIndices(
  faceGroups: readonly FaceGroupData[],
  featureColors: FeatureColorConfig,
  triangleCount: number,
  vertices: Float32Array
): ThreeMFColorConfig | null {
  if (isSingleColor(featureColors)) return null;

  const { colors, colorToIndex, defaultIndex } = resolveColorMapping(featureColors);

  const materials = colors.map((color) => ({ name: color, color }));
  const indices = new Array<number>(triangleCount).fill(defaultIndex);

  const triangleXY = (triIdx: number) => {
    const i = triIdx * 9;
    return {
      x: (vertices[i] + vertices[i + 3] + vertices[i + 6]) / 3,
      y: (vertices[i + 1] + vertices[i + 4] + vertices[i + 7]) / 3,
    };
  };

  const lipCenter = computeLipBBoxCenter(faceGroups, triangleXY);

  const materialIndexForZone = (zone: ColorZone): number => {
    const hex = getZoneColor(featureColors, zone);
    return colorToIndex.get(hex) ?? defaultIndex;
  };

  for (const group of faceGroups) {
    const triStart = group.start / 3;
    const triEnd = triStart + group.count / 3;

    if (group.tag === FeatureTag.LIP && lipCenter) {
      const { cx, cy } = lipCenter;
      for (let i = triStart; i < triEnd; i++) {
        const { x, y } = triangleXY(i);
        const corner = classifyLipCorner(x, y, cx, cy);
        indices[i] = materialIndexForZone(lipCornerZone(corner));
      }
      continue;
    }

    const zone = featureTagToColorZone(group.tag);
    if (zone === null) continue; // LIP without bbox center — leave at default
    const matIdx = materialIndexForZone(zone);
    for (let i = triStart; i < triEnd; i++) {
      indices[i] = matIdx;
    }
  }

  return { materials, triangleMaterialIndices: indices };
}
