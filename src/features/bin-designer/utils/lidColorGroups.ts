/**
 * Colour classification for the LID, which is a separate object from the bin
 * and so cannot ride the bin's multi-color path (`multiColorGroups.ts`).
 *
 * {@link classifyLidTriangles} is the one rule: the 3D preview builds its
 * material groups from it here, and the 3MF assembler
 * (`binDownloadHelpers.lidColorConfig`) paints from it, so the preview
 * cannot stop predicting the print.
 */

import { FeatureTag } from '@/shared/types/generation';
import type { FaceGroupData } from '@/shared/types/generation';
import type { MeshFaceGroup } from '@/shared/components/preview/useMeshGeometry';
import { collapseLidLipCell, getZoneColor, normalizeHex } from '../types/featureColors';
import type { ColorZone, FeatureColorConfig } from '../types/featureColors';
import {
  classifyLipBand,
  classifyLipCorner,
  computeLidLipGeom,
  type TriangleAccessor,
} from './lipCornerClassifier';

export interface LidColorGroupsResult {
  readonly groups: MeshFaceGroup[];
  readonly colors: readonly string[];
}

/**
 * The zone of every lid triangle: glyphs (`FeatureTag.TEXT`) take the Text
 * colour, the stack grid (`FeatureTag.LID_LIP`) folds into the `lidLip`
 * corner × band grid when one is stored, and everything else is `lid`.
 */
export function classifyLidTriangles(
  faceGroups: readonly FaceGroupData[],
  triangleCount: number,
  getTriangle: TriangleAccessor,
  featureColors: FeatureColorConfig
): ColorZone[] {
  const zones = new Array<ColorZone>(triangleCount).fill('lid');
  const grid = featureColors.lidLip;
  const geom = grid ? computeLidLipGeom(faceGroups, getTriangle) : null;
  for (const g of faceGroups) {
    const start = g.start / 3;
    const end = Math.min(start + g.count / 3, triangleCount);
    if (g.tag === FeatureTag.TEXT) {
      for (let t = start; t < end; t++) zones[t] = 'text';
    } else if (g.tag === FeatureTag.LID_LIP && grid && geom) {
      const counts = { corners: grid.corners, bands: grid.bands };
      for (let t = start; t < end; t++) {
        const v = getTriangle(t);
        const corner = classifyLipCorner(
          (v[0] + v[3] + v[6]) / 3,
          (v[1] + v[4] + v[7]) / 3,
          geom.cx,
          geom.cy
        );
        const band = classifyLipBand((v[2] + v[5] + v[8]) / 3, geom.minZ, geom.maxZ, counts.bands);
        zones[t] = collapseLidLipCell(corner, band, counts);
      }
    }
  }
  return zones;
}

/**
 * Returns null when the lid renders as one flat colour, so the caller keeps its
 * single-material fast path.
 */
export function buildLidColorGroups(
  faceGroups: readonly FaceGroupData[] | null | undefined,
  vertices: Float32Array | null | undefined,
  indices: Uint32Array | null | undefined,
  featureColors: FeatureColorConfig
): LidColorGroupsResult | null {
  if (!faceGroups || !vertices || !indices) return null;

  const getTriangle = (t: number): number[] => {
    const i = t * 3;
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    return [
      vertices[a],
      vertices[a + 1],
      vertices[a + 2],
      vertices[b],
      vertices[b + 1],
      vertices[b + 2],
      vertices[c],
      vertices[c + 1],
      vertices[c + 2],
    ];
  };

  const triangleCount = indices.length / 3;
  const zones = classifyLidTriangles(faceGroups, triangleCount, getTriangle, featureColors);

  // One slot per distinct colour, the lid colour first so the common all-lid
  // case coalesces into a single group.
  const lidHex = normalizeHex(getZoneColor(featureColors, 'lid'));
  const colors: string[] = [lidHex];
  const slotByHex = new Map<string, number>([[lidHex, 0]]);
  const slotByZone = new Map<ColorZone, number>();
  const slotOf = (zone: ColorZone): number => {
    const cached = slotByZone.get(zone);
    if (cached !== undefined) return cached;
    const hex = normalizeHex(getZoneColor(featureColors, zone));
    let slot = slotByHex.get(hex);
    if (slot === undefined) {
      slot = colors.length;
      slotByHex.set(hex, slot);
      colors.push(hex);
    }
    slotByZone.set(zone, slot);
    return slot;
  };
  const triMaterial = zones.map(slotOf);

  if (colors.length === 1) return null;

  const groups: MeshFaceGroup[] = [];
  let runStart = 0;
  let runIndex = triMaterial[0];
  for (let i = 1; i < triMaterial.length; i++) {
    if (triMaterial[i] !== runIndex) {
      groups.push({ start: runStart * 3, count: (i - runStart) * 3, materialIndex: runIndex });
      runStart = i;
      runIndex = triMaterial[i];
    }
  }
  groups.push({
    start: runStart * 3,
    count: (triMaterial.length - runStart) * 3,
    materialIndex: runIndex,
  });

  return { groups, colors };
}
