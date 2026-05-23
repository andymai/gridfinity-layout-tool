/**
 * 3MF export material mapping. LIP triangles are subdivided per corner
 * via centroid quadrant — see `lipCornerClassifier`.
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
 * `vertices` is the flat STL-style array (9 floats per triangle) — read
 * only to compute centroids for LIP triangles. `activeZones` filters out
 * zones whose feature isn't enabled, so a stale color on a hidden zone
 * (e.g. a lip corner recolor on a stacking-lip-off bin) doesn't trip
 * multi-color export. Matches the preview's gating. Returns null when
 * the design is single-color (no basematerials section needed).
 */
export function buildTriangleMaterialIndices(
  faceGroups: readonly FaceGroupData[],
  featureColors: FeatureColorConfig,
  triangleCount: number,
  vertices: Float32Array,
  activeZones: ReadonlySet<ColorZone>
): ThreeMFColorConfig | null {
  if (isSingleColor(featureColors, activeZones)) return null;

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
    // `colorToIndex` is keyed by lowercased hex; normalize here so a config
    // with mixed-case hex still resolves to the right material slot.
    const hex = getZoneColor(featureColors, zone).toLowerCase();
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
