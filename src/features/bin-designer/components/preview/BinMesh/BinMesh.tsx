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
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { LIP_CORNERS, lipCornerZone } from '@/features/bin-designer/types/featureColors';
import type { ColorZone } from '@/features/bin-designer/types/featureColors';
import {
  buildMultiColorGroups,
  hoveredMaterialIndices,
} from '@/features/bin-designer/utils/multiColorGroups';

const EDGE_COLOR = '#000000';

interface BinMeshProps {
  wireframe: boolean;
  /** Base color for the bin (user-selectable) */
  color: string;
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
    hasBase,
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
        // Flat-style bins skip the buildBaseSocket pass in shellStage, so
        // there are no FeatureTag.SOCKET faces for the Base zone to color.
        hasBase: s.params.base.style !== 'flat',
        hasScoop: s.params.scoop.enabled,
        hasDividers: cells.length > 1 && cells.some((c) => c !== firstCell),
        hoveredColorZone: s.ui.hoveredColorZone,
      };
    })
  );

  const activeZones = useMemo(() => {
    const zones = new Set<ColorZone>(['body']);
    if (hasBase) zones.add('base');
    if (hasLip) {
      for (const corner of LIP_CORNERS) zones.add(lipCornerZone(corner));
    }
    if (hasLabelTabs) zones.add('labelTab');
    if (hasScoop) zones.add('scoop');
    if (hasDividers) zones.add('dividers');
    return zones;
  }, [hasBase, hasLip, hasLabelTabs, hasScoop, hasDividers]);

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

    const hoveredIndices = hoveredMaterialIndices(hoveredColorZone);

    return multiColorData.zoneColors.map(
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
  }, [multiColorData, wireframe, hasPrecomputedNormals, hoveredColorZone]);

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
