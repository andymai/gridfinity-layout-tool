/**
 * Renders generated bin geometry as a Three.js mesh with PBR material.
 * Uses scene lighting (hemisphere + directional) for natural shading
 * with FrontSide face culling for correct visibility.
 *
 * Features:
 * - Dynamic flat shading for large bins (GPU-computed normals)
 * - Pre-computed BREP edge lines from worker (avoids main-thread EdgesGeometry)
 * - polygonOffset to prevent z-fighting with edge lines
 * - Per-corner lip coloring: lip face groups are sub-grouped by triangle
 *   centroid quadrant relative to the lip's outer bbox center.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Detailed } from '@react-three/drei';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useShallow } from 'zustand/react/shallow';
import { useMeshGeometry, useCoarseGeometry } from '@/shared/components/preview/useMeshGeometry';
import type { MeshFaceGroup } from '@/shared/components/preview/useMeshGeometry';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { FeatureTag } from '@/shared/types/generation';
import {
  featureTagToColorZone,
  getZoneColor,
  isSingleColor,
  lipCornerZone,
  resolveColorMapping,
} from '@/features/bin-designer/types/featureColors';
import type { ColorZone, HoverableZone } from '@/features/bin-designer/types/featureColors';
import type { FaceGroupData } from '@/shared/types/generation';
import type { FeatureColorConfig } from '@/features/bin-designer/types/featureColors';
import {
  classifyLipCorner,
  computeLipBBoxCenter,
} from '@/features/bin-designer/utils/lipCornerClassifier';

/** Edge line color (black for sketch look) */
const EDGE_COLOR = '#000000';

interface BinMeshProps {
  wireframe: boolean;
  /** Base color for the bin (user-selectable) */
  color: string;
}

/**
 * Builds MeshFaceGroup[] and the unique color list from FaceGroupData +
 * color config. Returns null when single-color.
 *
 * Lip face groups are walked triangle-by-triangle to assign each one to
 * its corner zone, and runs of same-corner triangles are coalesced into
 * a single MeshFaceGroup so Three.js doesn't see thousands of 1-triangle
 * draw calls for a typical lip.
 */
function buildMultiColorGroups(
  faceGroups: readonly FaceGroupData[],
  vertices: Float32Array,
  indices: Uint32Array,
  featureColors: FeatureColorConfig,
  activeZones: ReadonlySet<ColorZone>,
  totalIndexCount: number
): {
  groups: MeshFaceGroup[];
  colors: readonly string[];
  colorToIndex: ReadonlyMap<string, number>;
} | null {
  if (isSingleColor(featureColors, activeZones)) return null;

  const { colors, colorToIndex, defaultIndex } = resolveColorMapping(featureColors);

  const materialIndexForZone = (zone: ColorZone): number => {
    const hex = getZoneColor(featureColors, zone);
    return colorToIndex.get(hex) ?? defaultIndex;
  };

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
    if (fg.start > cursor) {
      groups.push({ start: cursor, count: fg.start - cursor, materialIndex: defaultIndex });
    }

    if (fg.tag === FeatureTag.LIP && lipCenter) {
      const { cx, cy } = lipCenter;
      const triStart = fg.start / 3;
      const triEnd = triStart + fg.count / 3;
      let runStart = fg.start;
      let runIndex = materialIndexForZone(
        lipCornerZone(classifyLipCorner(triangleXY(triStart).x, triangleXY(triStart).y, cx, cy))
      );

      for (let i = triStart + 1; i < triEnd; i++) {
        const { x, y } = triangleXY(i);
        const corner = classifyLipCorner(x, y, cx, cy);
        const matIdx = materialIndexForZone(lipCornerZone(corner));
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
      const matIdx = zone === null ? defaultIndex : materialIndexForZone(zone);
      groups.push({ start: fg.start, count: fg.count, materialIndex: matIdx });
    }

    cursor = fg.start + fg.count;
  }

  if (cursor < totalIndexCount) {
    groups.push({ start: cursor, count: totalIndexCount - cursor, materialIndex: defaultIndex });
  }

  return { groups, colors, colorToIndex };
}

/**
 * Resolve the set of color indices that should glow for a given hover
 * target. Returns the empty set when nothing is hovered. The 'lip'
 * group-header lights every lip-corner color simultaneously, even when
 * the four corners use different hexes.
 */
function hoveredMaterialIndices(
  hover: HoverableZone | null,
  featureColors: FeatureColorConfig | null,
  colorToIndex: ReadonlyMap<string, number>
): ReadonlySet<number> {
  if (!hover || !featureColors) return new Set();
  if (hover === 'lip') {
    const out = new Set<number>();
    for (const corner of ['frontLeft', 'frontRight', 'backRight', 'backLeft'] as const) {
      const idx = colorToIndex.get(featureColors.lip[corner]);
      if (idx !== undefined) out.add(idx);
    }
    return out;
  }
  const idx = colorToIndex.get(getZoneColor(featureColors, hover));
  return idx === undefined ? new Set() : new Set([idx]);
}

export function BinMesh({ wireframe, color }: BinMeshProps) {
  const { invalidate } = useThree();
  const multiColorEnabled = useFeatureFlag('multi_color_export');

  const {
    vertices,
    normals,
    indices,
    edgeVertices,
    faceGroups,
    coarseLOD,
    featureColors,
    hasLip,
    hasLabelTabs,
    hasScoop,
    hasDividers,
    hoveredColorZone,
  } = useDesignerStore(
    useShallow((s) => {
      const cells = s.params.compartments.cells;
      const firstCell = cells[0] ?? 0;
      return {
        vertices: s.generation.mesh?.vertices ?? null,
        normals: s.generation.mesh?.normals ?? null,
        indices: s.generation.mesh?.indices ?? null,
        edgeVertices: s.generation.mesh?.edgeVertices ?? null,
        faceGroups: s.generation.mesh?.faceGroups ?? null,
        coarseLOD: s.generation.mesh?.coarseLOD ?? null,
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors is typed required but legacy persisted configs may omit it
        featureColors: s.params.featureColors ?? null,
        hasLip: s.params.base.stackingLip,
        hasLabelTabs: s.params.label.enabled,
        hasScoop: s.params.scoop.enabled,
        hasDividers: cells.length > 1 && cells.some((c) => c !== firstCell),
        hoveredColorZone: s.ui.hoveredColorZone,
      };
    })
  );

  // Active zones — drives single-color detection and hidden-zone filtering.
  // Base is always present since every bin has a body; the user-facing
  // "Base" zone (Gridfinity foot / SOCKET) similarly always exists.
  const activeZones = useMemo(() => {
    const zones = new Set<ColorZone>(['body', 'base']);
    if (hasLip) {
      zones.add('lip:frontLeft');
      zones.add('lip:frontRight');
      zones.add('lip:backRight');
      zones.add('lip:backLeft');
    }
    if (hasLabelTabs) zones.add('labelTab');
    if (hasScoop) zones.add('scoop');
    if (hasDividers) zones.add('dividers');
    return zones;
  }, [hasLip, hasLabelTabs, hasScoop, hasDividers]);

  // Build multi-color groups when feature is active
  const multiColorData = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors is null-coalesced upstream (legacy persisted configs); runtime guard kept as belt-and-suspenders.
    if (!multiColorEnabled || !faceGroups || !featureColors || !vertices || !indices) {
      return null;
    }
    return buildMultiColorGroups(
      faceGroups,
      vertices,
      indices,
      featureColors,
      activeZones,
      indices.length
    );
  }, [multiColorEnabled, faceGroups, featureColors, vertices, indices, activeZones]);

  const { geometry, edgesGeometry, hasPrecomputedNormals } = useMeshGeometry({
    vertices,
    normals,
    indices,
    edgeVertices,
    faceGroups: multiColorData?.groups,
  });

  const coarseGeometry = useCoarseGeometry(coarseLOD);

  // Build material array for multi-color, with hover glow applied
  const materials = useMemo(() => {
    if (!multiColorData) return null;

    const hoveredIndices = hoveredMaterialIndices(
      hoveredColorZone,
      featureColors,
      multiColorData.colorToIndex
    );

    return multiColorData.colors.map(
      (c, i) =>
        new THREE.MeshStandardMaterial({
          color: c,
          roughness: 0.45,
          metalness: 0,
          wireframe,
          side: THREE.DoubleSide,
          emissive: new THREE.Color(c),
          emissiveIntensity: hoveredIndices.has(i) ? 0.35 : 0.08,
          flatShading: !hasPrecomputedNormals,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        })
    );
  }, [multiColorData, wireframe, hasPrecomputedNormals, hoveredColorZone, featureColors]);

  // Dispose materials on change
  useEffect(() => {
    return () => {
      materials?.forEach((m) => m.dispose());
    };
  }, [materials]);

  // Invalidate frame when mesh data changes
  useEffect(() => {
    if (geometry) invalidate();
  }, [geometry, invalidate]);

  // Invalidate frame when visual props change
  useEffect(() => {
    invalidate();
  }, [wireframe, color, materials, invalidate]);

  // Invalidate when coarse geometry changes (LOD needs re-render)
  useEffect(() => {
    if (coarseGeometry) invalidate();
  }, [coarseGeometry, invalidate]);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors is null-coalesced upstream (legacy persisted configs); guard it
  const baseColor = multiColorEnabled && featureColors ? featureColors.body : color;

  // Single-color material props shared between fine mesh and coarse LOD
  const singleMatProps = useMemo(
    () => ({
      color: baseColor,
      roughness: 0.45,
      metalness: 0,
      wireframe,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(baseColor),
      emissiveIntensity: 0.08,
      flatShading: !hasPrecomputedNormals,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
    [baseColor, wireframe, hasPrecomputedNormals]
  );

  if (!geometry) return null;

  const fineMesh = materials ? (
    <mesh geometry={geometry} material={materials} />
  ) : (
    <mesh geometry={geometry}>
      <meshStandardMaterial {...singleMatProps} />
    </mesh>
  );

  return (
    <group position={[0, 0, 0.1]}>
      {coarseGeometry ? (
        <Detailed distances={[0, 300]}>
          {fineMesh}
          <mesh geometry={coarseGeometry}>
            <meshStandardMaterial {...singleMatProps} flatShading />
          </mesh>
        </Detailed>
      ) : (
        fineMesh
      )}
      {!wireframe && edgesGeometry && (
        <lineSegments geometry={edgesGeometry} renderOrder={1}>
          <lineBasicMaterial color={EDGE_COLOR} depthTest={true} />
        </lineSegments>
      )}
    </group>
  );
}
