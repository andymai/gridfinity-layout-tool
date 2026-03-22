/**
 * Material mapping for multi-color 3MF export.
 *
 * Maps FaceGroupData (per-face feature tags from the BREP generator)
 * to filament slot assignments based on the user's FeatureColorConfig.
 */

import type { FaceGroupData } from '@/shared/types/generation';
import type { ThreeMFColorConfig } from '@/shared/generation/export';
import type { FilamentSlot, FeatureColorConfig } from '../types/featureColors';
import { featureTagToColorZone, isSingleColor, resolveSlotMapping } from '../types/featureColors';

/**
 * Builds a per-triangle material index array from face groups and color assignments.
 *
 * Returns null when all zones map to the same filament slot (single-color — no
 * basematerials section needed in 3MF).
 *
 * @param faceGroups - Face groups from BREP generation, with start/count referencing the index buffer
 * @param featureColors - Per-zone filament slot assignment
 * @param palette - Global filament palette (up to 4 slots)
 * @param triangleCount - Total number of triangles in the mesh
 */
export function buildTriangleMaterialIndices(
  faceGroups: readonly FaceGroupData[],
  featureColors: FeatureColorConfig,
  palette: readonly FilamentSlot[],
  triangleCount: number
): ThreeMFColorConfig | null {
  if (isSingleColor(featureColors)) return null;

  const {
    items: materials,
    slotToIndex,
    defaultIndex,
  } = resolveSlotMapping(featureColors, palette, (slot) => ({
    name: slot.name,
    color: slot.color,
  }));

  const indices = new Array<number>(triangleCount).fill(defaultIndex);

  // Map each face group's triangles to their material index
  for (const group of faceGroups) {
    const zone = featureTagToColorZone(group.tag);
    const slotId = featureColors[zone];
    const materialIndex = slotToIndex.get(slotId) ?? defaultIndex;

    // FaceGroup start/count reference the index buffer (3 indices per triangle)
    const triStart = group.start / 3;
    const triEnd = triStart + group.count / 3;
    for (let i = triStart; i < triEnd; i++) {
      indices[i] = materialIndex;
    }
  }

  return { materials, triangleMaterialIndices: indices };
}
