/**
 * 3MF export material mapping. The lip is colored by a quadrant × band grid;
 * when that grid is non-trivial the lip triangles are split along the seam
 * planes (shared with the preview via {@link computeLipColoredMesh}) so the
 * exported `paint_color` boundaries are geometrically exact. Splitting changes
 * the triangle count, so the mapping returns the replacement flat vertices +
 * normals the caller must hand to the 3MF writer.
 */

import type { FaceGroupData } from '@/shared/types/generation';
import type { ThreeMFColorConfig } from '@/shared/generation/export';
import {
  getZoneColor,
  isSingleColor,
  lipCellsUniform,
  normalizeHex,
  resolveColorMapping,
} from '../types/featureColors';
import type { ColorZone, FeatureColorConfig } from '../types/featureColors';
import { computeLipGeom } from './lipCornerClassifier';
import { computeLipColoredMesh } from './lipSeamSplitter';

export interface BinColorMapping {
  readonly config: ThreeMFColorConfig;
  /** Replacement geometry when the lip grid was split (flat, 9 floats/tri). */
  readonly vertices?: Float32Array;
  readonly normals?: Float32Array;
}

/**
 * Build the 3MF color config (and, when the lip grid is split, the replacement
 * geometry). `vertices` is the flat STL-style array (9 floats per triangle).
 * `activeZones` filters zones whose feature isn't enabled so a stale color on a
 * hidden zone doesn't trip multi-color export. Returns null when the design is
 * single-color (no color section needed).
 */
export function buildTriangleMaterialIndices(
  faceGroups: readonly FaceGroupData[],
  featureColors: FeatureColorConfig,
  triangleCount: number,
  vertices: Float32Array,
  activeZones: ReadonlySet<ColorZone>
): BinColorMapping | null {
  if (isSingleColor(featureColors, activeZones)) return null;

  const { colors, colorToIndex, defaultIndex } = resolveColorMapping(featureColors);
  const materials = colors.map((color) => ({ color }));
  const counts = { corners: featureColors.lip.corners, bands: featureColors.lip.bands };

  const getTriangle = (i: number): number[] => {
    const b = i * 9;
    return [
      vertices[b],
      vertices[b + 1],
      vertices[b + 2],
      vertices[b + 3],
      vertices[b + 4],
      vertices[b + 5],
      vertices[b + 6],
      vertices[b + 7],
      vertices[b + 8],
    ];
  };
  const triangleXYZ = (i: number) => {
    const b = i * 9;
    return {
      x: (vertices[b] + vertices[b + 3] + vertices[b + 6]) / 3,
      y: (vertices[b + 1] + vertices[b + 4] + vertices[b + 7]) / 3,
      z: (vertices[b + 2] + vertices[b + 5] + vertices[b + 8]) / 3,
    };
  };

  const geom = computeLipGeom(faceGroups, triangleXYZ);
  const { triZones, positions, normals } = computeLipColoredMesh({
    triangleCount,
    faceGroups,
    getTriangle,
    geom,
    counts,
    lipUniform: lipCellsUniform(featureColors.lip),
  });

  const materialIndexForZone = (zone: ColorZone): number =>
    colorToIndex.get(normalizeHex(getZoneColor(featureColors, zone))) ?? defaultIndex;
  const triangleMaterialIndices = triZones.map(materialIndexForZone);

  const config: ThreeMFColorConfig = { materials, triangleMaterialIndices };
  if (positions && normals) {
    return { config, vertices: positions, normals };
  }
  return { config };
}
