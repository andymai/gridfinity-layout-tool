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
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';
import type { MeshFaceGroup } from '@/shared/components/preview/useMeshGeometry';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import {
  featureTagToColorZone,
  isSingleColor,
  resolveSlotMapping,
} from '@/features/bin-designer/types/featureColors';
import type { FaceGroupData } from '@/shared/types/generation';
import type { FeatureColorConfig, FilamentSlot } from '@/features/bin-designer/types/featureColors';

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
  palette: readonly FilamentSlot[],
  totalIndexCount: number
): { groups: MeshFaceGroup[]; colors: readonly string[] } | null {
  if (isSingleColor(featureColors)) return null;

  const {
    items: colors,
    slotToIndex,
    defaultIndex,
  } = resolveSlotMapping(featureColors, palette, (slot) => slot.color);

  // Sort by start position, then fill leading/interior/trailing gaps with body default
  const sorted = [...faceGroups].sort((a, b) => a.start - b.start);
  const groups: MeshFaceGroup[] = [];
  let cursor = 0;

  for (const fg of sorted) {
    if (fg.start > cursor) {
      groups.push({ start: cursor, count: fg.start - cursor, materialIndex: defaultIndex });
    }
    const zone = featureTagToColorZone(fg.tag);
    const slotId = featureColors[zone];
    groups.push({
      start: fg.start,
      count: fg.count,
      materialIndex: slotToIndex.get(slotId) ?? defaultIndex,
    });
    cursor = fg.start + fg.count;
  }

  if (cursor < totalIndexCount) {
    groups.push({ start: cursor, count: totalIndexCount - cursor, materialIndex: defaultIndex });
  }

  return { groups, colors };
}

export function BinMesh({ wireframe, color }: BinMeshProps) {
  const { invalidate } = useThree();
  const multiColorEnabled = useFeatureFlag('multi_color_export');

  const { vertices, normals, indices, edgeVertices, faceGroups, featureColors } = useDesignerStore(
    useShallow((s) => ({
      vertices: s.generation.mesh?.vertices ?? null,
      normals: s.generation.mesh?.normals ?? null,
      indices: s.generation.mesh?.indices ?? null,
      edgeVertices: s.generation.mesh?.edgeVertices ?? null,
      faceGroups: s.generation.mesh?.faceGroups ?? null,
      featureColors: s.params.featureColors ?? null,
    }))
  );

  const filamentPalette = useSettingsStore((s) => s.settings.filamentPalette);

  // Build multi-color groups when feature is active
  const multiColorData = useMemo(() => {
    if (!multiColorEnabled || !faceGroups || !featureColors || !indices) return null;
    return buildMultiColorGroups(faceGroups, featureColors, filamentPalette, indices.length);
  }, [multiColorEnabled, faceGroups, featureColors, filamentPalette, indices]);

  const { geometry, edgesGeometry } = useMeshGeometry({
    vertices,
    normals,
    indices,
    edgeVertices,
    faceGroups: multiColorData?.groups,
  });

  // Build material array for multi-color, or null for single-color
  const materials = useMemo(() => {
    if (!multiColorData) return null;
    return multiColorData.colors.map(
      (c) =>
        new THREE.MeshStandardMaterial({
          color: c,
          roughness: 0.45,
          metalness: 0,
          wireframe,
          side: THREE.DoubleSide,
          emissive: new THREE.Color(c),
          emissiveIntensity: 0.08,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        })
    );
  }, [multiColorData, wireframe]);

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

  if (!geometry) return null;

  return (
    <>
      {materials ? (
        <mesh geometry={geometry} position={[0, 0, 0.1]} material={materials} />
      ) : (
        <mesh geometry={geometry} position={[0, 0, 0.1]}>
          <meshStandardMaterial
            color={color}
            roughness={0.45}
            metalness={0}
            wireframe={wireframe}
            side={THREE.DoubleSide}
            emissive={color}
            emissiveIntensity={0.08}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
      )}
      {/* Edge lines from BREP topology (pre-computed in worker) */}
      {!wireframe && edgesGeometry && (
        <lineSegments geometry={edgesGeometry} position={[0, 0, 0.1]} renderOrder={1}>
          <lineBasicMaterial color={EDGE_COLOR} depthTest={true} />
        </lineSegments>
      )}
    </>
  );
}
