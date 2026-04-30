/**
 * Renders generated bin geometry as a Three.js mesh with PBR material.
 * Uses scene lighting (hemisphere + directional) for natural shading
 * with FrontSide face culling for correct visibility.
 *
 * Features:
 * - Dynamic flat shading for large bins (GPU-computed normals)
 * - Pre-computed BREP edge lines from worker (avoids main-thread EdgesGeometry)
 * - polygonOffset to prevent z-fighting with edge lines
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
import {
  featureTagToColorZone,
  isSingleColor,
  resolveColorMapping,
} from '@/features/bin-designer/types/featureColors';
import type { ColorZone } from '@/features/bin-designer/types/featureColors';
import type { FaceGroupData } from '@/shared/types/generation';
import type { FeatureColorConfig } from '@/features/bin-designer/types/featureColors';

/** Edge line color (black for sketch look) */
const EDGE_COLOR = '#000000';

interface BinMeshProps {
  wireframe: boolean;
  /** Base color for the bin (user-selectable) */
  color: string;
}

/**
 * Builds MeshFaceGroup[] and a material color array from FaceGroupData + color config.
 * Returns null when multi-color is not active (all zones same slot or missing data).
 */
function buildMultiColorGroups(
  faceGroups: readonly FaceGroupData[],
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

  // Sort by start position, then fill leading/interior/trailing gaps with body default
  const sorted = [...faceGroups].sort((a, b) => a.start - b.start);
  const groups: MeshFaceGroup[] = [];
  let cursor = 0;

  for (const fg of sorted) {
    if (fg.start > cursor) {
      groups.push({ start: cursor, count: fg.start - cursor, materialIndex: defaultIndex });
    }
    const zone = featureTagToColorZone(fg.tag);
    const hex = featureColors[zone];
    groups.push({
      start: fg.start,
      count: fg.count,
      materialIndex: colorToIndex.get(hex) ?? defaultIndex,
    });
    cursor = fg.start + fg.count;
  }

  if (cursor < totalIndexCount) {
    groups.push({ start: cursor, count: totalIndexCount - cursor, materialIndex: defaultIndex });
  }

  return { groups, colors, colorToIndex };
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
    hoveredColorZone,
  } = useDesignerStore(
    useShallow((s) => ({
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
      hoveredColorZone: s.ui.hoveredColorZone,
    }))
  );

  // Build active zone set — scales as more zones are added
  const activeZones = useMemo(() => {
    const zones = new Set<ColorZone>(['body']);
    if (hasLip) zones.add('lip');
    if (hasLabelTabs) zones.add('labelTab');
    return zones;
  }, [hasLip, hasLabelTabs]);

  // Build multi-color groups when feature is active
  const multiColorData = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors is null-coalesced upstream (legacy persisted configs); guard it
    if (!multiColorEnabled || !faceGroups || !featureColors || !indices) return null;
    return buildMultiColorGroups(faceGroups, featureColors, activeZones, indices.length);
  }, [multiColorEnabled, faceGroups, featureColors, activeZones, indices]);

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

    // Determine which material index is hovered (if any)
    let hoveredIndex: number | undefined;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors is null-coalesced upstream (legacy persisted configs); guard it
    if (hoveredColorZone && featureColors) {
      const hoveredHex = featureColors[hoveredColorZone];
      hoveredIndex = multiColorData.colorToIndex.get(hoveredHex);
    }

    return multiColorData.colors.map(
      (c, i) =>
        new THREE.MeshStandardMaterial({
          color: c,
          roughness: 0.45,
          metalness: 0,
          wireframe,
          side: THREE.DoubleSide,
          emissive: new THREE.Color(c),
          emissiveIntensity: i === hoveredIndex ? 0.35 : 0.08,
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
        // LOD: fine mesh at distance 0, coarse at 300mm (zoomed out)
        <Detailed distances={[0, 300]}>
          {fineMesh}
          <mesh geometry={coarseGeometry}>
            <meshStandardMaterial {...singleMatProps} flatShading />
          </mesh>
        </Detailed>
      ) : (
        fineMesh
      )}
      {/* Edge lines from BREP topology (pre-computed in worker, fine LOD only) */}
      {!wireframe && edgesGeometry && (
        <lineSegments geometry={edgesGeometry} renderOrder={1}>
          <lineBasicMaterial color={EDGE_COLOR} depthTest={true} />
        </lineSegments>
      )}
    </group>
  );
}
