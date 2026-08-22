/**
 * Material groups for the LID's own top lip in the 3D preview.
 *
 * The lid is a separate object from the bin, so it cannot ride the bin's
 * multi-color path (`multiColorGroups.ts`) — that one classifies the BIN lip,
 * cutouts, and the top-accent band against the bin mesh's extents.
 *
 * Classification here is deliberately the same rule the 3MF assembler uses in
 * `binDownloadHelpers.lidColorConfig`: LID_LIP triangles fold into the `lidLip`
 * corner × band grid, everything else takes the flat `lid` colour. If the two
 * ever diverge the preview stops predicting the print, which is the exact class
 * of bug GH was filed for.
 */

import { FeatureTag } from '@/shared/types/generation';
import type { FaceGroupData } from '@/shared/types/generation';
import type { MeshFaceGroup } from '@/shared/components/preview/useMeshGeometry';
import { collapseLidLipCell, getZoneColor, normalizeHex } from '../types/featureColors';
import type { FeatureColorConfig } from '../types/featureColors';
import { classifyLipBand, classifyLipCorner, computeLidLipGeom } from './lipCornerClassifier';

export interface LidColorGroupsResult {
  readonly groups: MeshFaceGroup[];
  readonly colors: readonly string[];
}

/**
 * Returns null when the lid renders as one flat colour — no stored grid, no
 * LID_LIP geometry, or every active cell already matching the lid colour. The
 * caller then keeps its single-material fast path.
 */
export function buildLidColorGroups(
  faceGroups: readonly FaceGroupData[] | null | undefined,
  vertices: Float32Array | null | undefined,
  indices: Uint32Array | null | undefined,
  featureColors: FeatureColorConfig
): LidColorGroupsResult | null {
  const grid = featureColors.lidLip;
  if (!grid || !faceGroups || !vertices || !indices) return null;

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
  const triangleXYZ = (t: number) => {
    const v = getTriangle(t);
    return {
      x: (v[0] + v[3] + v[6]) / 3,
      y: (v[1] + v[4] + v[7]) / 3,
      z: (v[2] + v[5] + v[8]) / 3,
    };
  };

  const geom = computeLidLipGeom(faceGroups, getTriangle);
  if (!geom) return null;

  const counts = { corners: grid.corners, bands: grid.bands };
  const lidHex = normalizeHex(getZoneColor(featureColors, 'lid'));

  // One slot per distinct colour. Built in first-seen order with the lid colour
  // at 0 so the common all-lid case coalesces into a single group.
  const colorToIndex = new Map<string, number>([[lidHex, 0]]);
  const colors: string[] = [lidHex];
  const slotOf = (hex: string): number => {
    const existing = colorToIndex.get(hex);
    if (existing !== undefined) return existing;
    colorToIndex.set(hex, colors.length);
    colors.push(hex);
    return colors.length - 1;
  };

  const triangleCount = indices.length / 3;
  const triMaterial = new Array<number>(triangleCount).fill(0);
  for (const g of faceGroups) {
    if (g.tag !== FeatureTag.LID_LIP) continue;
    const start = g.start / 3;
    const end = Math.min(start + g.count / 3, triangleCount);
    for (let t = start; t < end; t++) {
      const { x, y, z } = triangleXYZ(t);
      const corner = classifyLipCorner(x, y, geom.cx, geom.cy);
      const band = classifyLipBand(z, geom.minZ, geom.maxZ, counts.bands);
      const zone = collapseLidLipCell(corner, band, counts);
      triMaterial[t] = slotOf(normalizeHex(getZoneColor(featureColors, zone)));
    }
  }

  // Every triangle landed on the lid colour, so there is nothing to show.
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
