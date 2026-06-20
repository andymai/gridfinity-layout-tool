/**
 * Pure transformations for the 3D preview's multi-color path.
 *
 * Allocates one material slot per `ColorZone` (no hex deduping) so the
 * hover-glow can target a single zone without bleeding into other zones
 * that happen to share its color — a common case right after migration,
 * when new zones inherit the body color.
 *
 * When the lip color grid is non-trivial (more than one corner or band),
 * the lip is re-tessellated along the seam planes via {@link splitLipMesh}
 * so color boundaries are geometrically exact; the returned `meshOverride`
 * carries the new flat geometry the preview must render. The same splitter
 * drives the 3MF exporter (see `materialMapping.ts`), so preview == export.
 *
 * `triZones` is the per-rendered-triangle zone array — it doubles as the
 * hit-test source (replacing centroid re-classification) and the basis for
 * the coalesced material groups, guaranteeing the three agree.
 */

import type { FaceGroupData } from '@/shared/types/generation';
import type { MeshFaceGroup } from '@/shared/components/preview/useMeshGeometry';
import {
  LIP_CELL_ZONES,
  ZONE_ORDER,
  getZoneColor,
  isSingleColor,
  lipCellsUniform,
  zoneIndex,
} from '../types/featureColors';
import type { ColorZone, FeatureColorConfig, HoverableZone } from '../types/featureColors';
import { computeLipGeom } from './lipCornerClassifier';
import { computeLipColoredMesh } from './lipSeamSplitter';

export interface MultiColorGroupsResult {
  readonly groups: MeshFaceGroup[];
  readonly zoneColors: readonly string[];
  /** Zone of each rendered triangle (in render order). Hit-test reads this. */
  readonly triZones: readonly ColorZone[];
  /**
   * Replacement geometry when the lip was split. `vertices`/`normals` are flat
   * (9 floats/triangle); `indices` is null (non-indexed). Null when the lip
   * grid is trivial — the caller keeps the original worker buffers.
   */
  readonly meshOverride: {
    readonly vertices: Float32Array;
    readonly normals: Float32Array;
    readonly indices: null;
  } | null;
}

/** Coalesce consecutive same-zone triangles into Three.js material groups. */
function coalesceGroups(triZones: readonly ColorZone[]): MeshFaceGroup[] {
  const groups: MeshFaceGroup[] = [];
  if (triZones.length === 0) return groups;
  let runStart = 0;
  let runIndex = zoneIndex(triZones[0]);
  for (let i = 1; i < triZones.length; i++) {
    const idx = zoneIndex(triZones[i]);
    if (idx !== runIndex) {
      groups.push({ start: runStart * 3, count: (i - runStart) * 3, materialIndex: runIndex });
      runStart = i;
      runIndex = idx;
    }
  }
  groups.push({
    start: runStart * 3,
    count: (triZones.length - runStart) * 3,
    materialIndex: runIndex,
  });
  return groups;
}

/** Per-triangle centroid + flat-triangle accessors over an indexed mesh, plus lip geom. */
function meshAccessors(
  faceGroups: readonly FaceGroupData[],
  vertices: Float32Array,
  indices: Uint32Array
): {
  triangleCount: number;
  geom: ReturnType<typeof computeLipGeom>;
  getTriangle: (i: number) => number[];
} {
  const triangleCount = indices.length / 3;
  const triangleXYZ = (triIdx: number) => {
    const i = triIdx * 3;
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    return {
      x: (vertices[a] + vertices[b] + vertices[c]) / 3,
      y: (vertices[a + 1] + vertices[b + 1] + vertices[c + 1]) / 3,
      z: (vertices[a + 2] + vertices[b + 2] + vertices[c + 2]) / 3,
    };
  };
  const getTriangle = (i: number): number[] => {
    const base = i * 3;
    const a = indices[base] * 3;
    const b = indices[base + 1] * 3;
    const c = indices[base + 2] * 3;
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
  return { triangleCount, geom: computeLipGeom(faceGroups, triangleXYZ), getTriangle };
}

/**
 * Per-original-triangle zones for canvas hit-testing (eyedropper/swap), built
 * even when the design is currently single-color. `buildMultiColorGroups`
 * returns null in that state, so without this the tools couldn't resolve a
 * clicked zone to start editing (the "just enabled multi-color, no colors
 * changed yet" case). Classifies in place over the un-split mesh, matching the
 * geometry rendered when there's no split override.
 */
export function buildHitTestZones(
  faceGroups: readonly FaceGroupData[],
  vertices: Float32Array,
  indices: Uint32Array,
  featureColors: FeatureColorConfig
): ColorZone[] {
  const counts = { corners: featureColors.lip.corners, bands: featureColors.lip.bands };
  const { triangleCount, geom, getTriangle } = meshAccessors(faceGroups, vertices, indices);
  return computeLipColoredMesh({
    triangleCount,
    faceGroups,
    getTriangle,
    geom,
    counts,
    lipUniform: true,
  }).triZones;
}

/**
 * Build the material groups, per-zone colors, per-triangle zones, and (when
 * the lip grid is split) replacement geometry for the preview.
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

  const counts = { corners: featureColors.lip.corners, bands: featureColors.lip.bands };
  const { triangleCount, geom, getTriangle } = meshAccessors(faceGroups, vertices, indices);

  const { triZones, positions, normals } = computeLipColoredMesh({
    triangleCount,
    faceGroups,
    getTriangle,
    geom,
    counts,
    lipUniform: lipCellsUniform(featureColors.lip),
  });
  const meshOverride: MultiColorGroupsResult['meshOverride'] =
    positions && normals ? { vertices: positions, normals, indices: null } : null;

  const groups = coalesceGroups(triZones);
  const zoneColors = ZONE_ORDER.map((z) => getZoneColor(featureColors, z));
  return { groups, zoneColors, triZones, meshOverride };
}

/**
 * Material-slot indices that should glow for the given hover target. The
 * 'lip' group-header lights all lip cell slots; a concrete zone lights only
 * its own slot. Because we don't dedup by hex, two zones with the same color
 * still glow independently.
 */
export function hoveredMaterialIndices(hover: HoverableZone | null): ReadonlySet<number> {
  if (!hover) return new Set();
  if (hover === 'lip') {
    return new Set(LIP_CELL_ZONES.map((z) => zoneIndex(z)));
  }
  return new Set([zoneIndex(hover)]);
}
