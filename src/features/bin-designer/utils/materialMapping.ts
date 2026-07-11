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
  maxZOfVertices,
  normalizeHex,
  resolveColorMapping,
  topAccentActive,
  topAccentCutZ,
} from '../types/featureColors';
import type { ColorZone, FeatureColorConfig } from '../types/featureColors';
import { computeLipGeom } from './lipCornerClassifier';
import { computeLipColoredMesh } from './lipSeamSplitter';
import { resolveCutoutTriColor, cutoutOrdinalFromTag } from '@/shared/generation/cutoutColorUnits';
import type { CutoutColorUnit } from '@/shared/generation/cutoutColorUnits';

/** |normal.z| of the first vertex of flat triangle `i` (9 floats/tri). */
function absNormalZ(flat: Float32Array | ArrayLike<number>, i: number): number {
  const b = i * 9;
  const ux = flat[b + 3] - flat[b];
  const uy = flat[b + 4] - flat[b + 1];
  const uz = flat[b + 5] - flat[b + 2];
  const vx = flat[b + 6] - flat[b];
  const vy = flat[b + 7] - flat[b + 1];
  const vz = flat[b + 8] - flat[b + 2];
  const nz = ux * vy - uy * vx;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  return Math.abs(nz) / (Math.hypot(nx, ny, nz) || 1);
}

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
  activeZones: ReadonlySet<ColorZone>,
  cutoutUnits: readonly CutoutColorUnit[] = []
): BinColorMapping | null {
  const coloredUnits = cutoutUnits.filter((u) => u.color !== undefined);
  // Derive the top-accent cut from featureColors directly (see the matching note
  // in multiColorGroups.ts) so it's honored even if a caller's activeZones omits
  // it; union it in so isSingleColor accounts for the accent color. Gate the maxZ
  // scan on `topAccentActive` to skip the traversal when the band is off.
  const cutZ = topAccentActive(featureColors.topAccent)
    ? topAccentCutZ(featureColors.topAccent, maxZOfVertices(vertices))
    : null;
  const zones =
    cutZ !== null && !activeZones.has('topAccent')
      ? new Set(activeZones).add('topAccent')
      : activeZones;
  if (isSingleColor(featureColors, zones) && coloredUnits.length === 0) return null;

  const base = resolveColorMapping(featureColors);
  const defaultIndex = base.defaultIndex;
  // Extend the material palette with cutout colors, deduped by hex in lockstep
  // with the zone colors so identical filaments collapse to one 3MF material.
  const colors = [...base.colors];
  const colorToIndex = new Map(base.colorToIndex);
  for (const u of coloredUnits) {
    const hex = normalizeHex(u.color as string);
    if (!colorToIndex.has(hex)) {
      colorToIndex.set(hex, colors.length);
      colors.push(hex);
    }
  }
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
  const { triZones, positions, normals, triTags } = computeLipColoredMesh({
    triangleCount,
    faceGroups,
    getTriangle,
    geom,
    counts,
    lipUniform: lipCellsUniform(featureColors.lip),
    topAccentCutZ: cutZ,
  });

  const materialIndexForZone = (zone: ColorZone): number =>
    colorToIndex.get(normalizeHex(getZoneColor(featureColors, zone))) ?? defaultIndex;
  // Split path returns per-triangle face normals directly (same normal on all 3
  // verts, so compute nothing — read nz). In-place path keeps the original
  // triangles, so derive the normal from `vertices`.
  const nzAt = (i: number): number =>
    normals ? Math.abs(normals[i * 9 + 2]) : absNormalZ(vertices, i);
  const triangleMaterialIndices = triZones.map((zone, i) => {
    // Only cutout-tagged triangles need floor/wall math — skip nz for the rest.
    if (coloredUnits.length > 0 && cutoutOrdinalFromTag(triTags[i]) !== null) {
      const cutoutHex = resolveCutoutTriColor(triTags[i], nzAt(i), cutoutUnits);
      if (cutoutHex !== null) return colorToIndex.get(normalizeHex(cutoutHex)) ?? defaultIndex;
    }
    return materialIndexForZone(zone);
  });

  const config: ThreeMFColorConfig = { materials, triangleMaterialIndices };
  if (positions && normals) {
    return { config, vertices: positions, normals };
  }
  return { config };
}
