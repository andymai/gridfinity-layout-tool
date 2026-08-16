/**
 * paint_color mapping for swappable label plate 3MF exports.
 *
 * Plates carry exactly two zones: the plate body and the glyph faces the
 * worker tagged `FeatureTag.TEXT`. When the design's multi-color zones are
 * enabled, the plate takes the label-tab zone color (the face it visually
 * replaces) and the text takes the text zone color — the same pairing a
 * printed-in tab uses, so plates match their bins on multi-material
 * printers. Single-color designs (or matching zone colors) export without
 * material indices, exactly as before.
 */

import type { FaceGroupData } from '@/shared/types/generation';
import { FeatureTag } from '@/shared/types/generation';
import type { ThreeMFColorConfig } from '@/shared/generation/export';
import type { FeatureColorConfig } from '../types';
import { getZoneColor, normalizeHex } from '../types/featureColors';

export function buildLabelPlateColorConfig(
  faceGroups: readonly FaceGroupData[] | undefined,
  triangleCount: number,
  featureColors: FeatureColorConfig | undefined
): ThreeMFColorConfig | undefined {
  if (!featureColors?.enabled || !faceGroups || faceGroups.length === 0) return undefined;

  const bodyHex = normalizeHex(getZoneColor(featureColors, 'labelTab'));
  const textHex = normalizeHex(getZoneColor(featureColors, 'text'));
  if (bodyHex === textHex) return undefined;

  const triangleMaterialIndices = new Array<number>(triangleCount).fill(0);
  let textTriangles = 0;
  for (const group of faceGroups) {
    if (group.tag !== FeatureTag.TEXT) continue;
    const start = group.start / 3;
    const end = Math.min(start + group.count / 3, triangleCount);
    for (let i = start; i < end; i++) {
      triangleMaterialIndices[i] = 1;
      textTriangles++;
    }
  }
  if (textTriangles === 0) return undefined;

  return {
    materials: [{ color: bodyHex }, { color: textHex }],
    triangleMaterialIndices,
  };
}
