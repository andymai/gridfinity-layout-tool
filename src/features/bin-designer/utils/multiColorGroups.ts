/**
 * Pure transformations for the 3D preview's multi-color path.
 *
 * Allocates one material slot per `ColorZone` (no hex deduping) so the
 * hover-glow can target a single zone without bleeding into other zones
 * that happen to share its color — a common case right after migration,
 * when new zones inherit the body color.
 *
 * The 3MF export pipeline does its own hex-deduped material mapping
 * separately (see `materialMapping.ts`).
 */

import { FeatureTag } from '@/shared/types/generation';
import type { FaceGroupData } from '@/shared/types/generation';
import type { MeshFaceGroup } from '@/shared/components/preview/useMeshGeometry';
import {
  LIP_CORNERS,
  ZONE_ORDER,
  featureTagToColorZone,
  getZoneColor,
  isSingleColor,
  lipCornerZone,
  zoneIndex,
} from '../types/featureColors';
import type { ColorZone, FeatureColorConfig, HoverableZone } from '../types/featureColors';
import { classifyLipCorner, computeLipBBoxCenter } from './lipCornerClassifier';

export interface MultiColorGroupsResult {
  readonly groups: MeshFaceGroup[];
  readonly zoneColors: readonly string[];
}

/**
 * Build the MeshFaceGroup list and per-zone color array for the preview.
 *
 * Lip face groups are walked triangle-by-triangle to classify each one
 * by corner; runs of same-corner triangles coalesce into a single group
 * so Three.js doesn't see thousands of 1-triangle draws.
 *
 * Returns null when the design is single-color across all active zones.
 */
export function buildMultiColorGroups(
  faceGroups: readonly FaceGroupData[],
  vertices: Float32Array,
  indices: Uint32Array,
  featureColors: FeatureColorConfig,
  activeZones: ReadonlySet<ColorZone>
): MultiColorGroupsResult | null {
  if (isSingleColor(featureColors, activeZones)) return null;

  const BODY_INDEX = zoneIndex('body');

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

  const sorted = [...faceGroups].sort((a, b) => a.start - b.start);
  const groups: MeshFaceGroup[] = [];
  let cursor = 0;

  for (const fg of sorted) {
    if (fg.count === 0) continue;
    if (fg.start > cursor) {
      groups.push({ start: cursor, count: fg.start - cursor, materialIndex: BODY_INDEX });
    }

    if (fg.tag === FeatureTag.LIP && lipCenter) {
      const { cx, cy } = lipCenter;
      const triStart = fg.start / 3;
      const triEnd = triStart + fg.count / 3;
      const first = triangleXY(triStart);
      let runStart = fg.start;
      let runIndex = zoneIndex(lipCornerZone(classifyLipCorner(first.x, first.y, cx, cy)));

      for (let i = triStart + 1; i < triEnd; i++) {
        const { x, y } = triangleXY(i);
        const matIdx = zoneIndex(lipCornerZone(classifyLipCorner(x, y, cx, cy)));
        if (matIdx !== runIndex) {
          groups.push({ start: runStart, count: i * 3 - runStart, materialIndex: runIndex });
          runStart = i * 3;
          runIndex = matIdx;
        }
      }
      groups.push({
        start: runStart,
        count: fg.start + fg.count - runStart,
        materialIndex: runIndex,
      });
    } else {
      const zone = featureTagToColorZone(fg.tag);
      const matIdx = zone === null ? BODY_INDEX : zoneIndex(zone);
      groups.push({ start: fg.start, count: fg.count, materialIndex: matIdx });
    }

    cursor = fg.start + fg.count;
  }

  if (cursor < indices.length) {
    groups.push({ start: cursor, count: indices.length - cursor, materialIndex: BODY_INDEX });
  }

  const zoneColors = ZONE_ORDER.map((z) => getZoneColor(featureColors, z));
  return { groups, zoneColors };
}

/**
 * Material-slot indices that should glow for the given hover target. The
 * 'lip' group-header lights all four corner slots; a concrete zone lights
 * only its own slot. Because we don't dedup by hex, two zones with the
 * same color still glow independently.
 */
export function hoveredMaterialIndices(hover: HoverableZone | null): ReadonlySet<number> {
  if (!hover) return new Set();
  if (hover === 'lip') {
    return new Set(LIP_CORNERS.map((c) => zoneIndex(lipCornerZone(c))));
  }
  return new Set([zoneIndex(hover)]);
}
