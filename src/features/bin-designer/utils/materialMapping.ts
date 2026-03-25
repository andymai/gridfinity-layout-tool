/**
 * Material mapping for multi-color 3MF export.
 *
 * Maps FaceGroupData (per-face feature tags from the BREP generator)
 * to color assignments based on the user's FeatureColorConfig.
 */

import type { FaceGroupData } from '@/shared/types/generation';
import type { ThreeMFColorConfig } from '@/shared/generation/export';
import type { FeatureColorConfig } from '../types/featureColors';
import { featureTagToColorZone, isSingleColor, resolveColorMapping } from '../types/featureColors';

/**
 * Builds a per-triangle material index array from face groups and color assignments.
 *
 * Returns null when all zones use the same color (single-color — no
 * basematerials section needed in 3MF).
 *
 * @param faceGroups - Face groups from BREP generation
 * @param featureColors - Per-zone hex color assignment
 * @param triangleCount - Total number of triangles in the mesh
 */
export function buildTriangleMaterialIndices(
  faceGroups: readonly FaceGroupData[],
  featureColors: FeatureColorConfig,
  triangleCount: number
): ThreeMFColorConfig | null {
  if (isSingleColor(featureColors)) return null;

  const { colors, colorToIndex, defaultIndex } = resolveColorMapping(featureColors);

  const materials = colors.map((color) => ({ name: color, color }));
  const indices = new Array<number>(triangleCount).fill(defaultIndex);

  for (const group of faceGroups) {
    const zone = featureTagToColorZone(group.tag);
    const hex = featureColors[zone];
    const materialIndex = colorToIndex.get(hex) ?? defaultIndex;

    const triStart = group.start / 3;
    const triEnd = triStart + group.count / 3;
    for (let i = triStart; i < triEnd; i++) {
      indices[i] = materialIndex;
    }
  }

  return { materials, triangleMaterialIndices: indices };
}
