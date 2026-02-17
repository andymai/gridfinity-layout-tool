/**
 * Renders generated bin geometry as a Three.js mesh with PBR material.
 * Uses scene lighting (hemisphere + directional) for natural shading
 * with FrontSide face culling for correct visibility.
 *
 * Features:
 * - Dynamic flat shading for large bins (GPU-computed normals)
 * - Pre-computed BREP edge lines from worker (avoids main-thread EdgesGeometry)
 * - polygonOffset to prevent z-fighting with edge lines
 * - Optional feature-colored multi-material mode for face provenance visualization
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store/settings';
import { useShallow } from 'zustand/react/shallow';
import { FEATURE_TAG_COLORS } from '@/shared/generation/featureTags';
import type { FaceGroupData } from '@/shared/types/generation';

/** Edge line color (black for sketch look) */
const EDGE_COLOR = '#000000';

/** Default color for unknown feature tags */
const FALLBACK_TAG_COLOR = '#6B7280';

interface BinMeshProps {
  wireframe: boolean;
  /** Base color for the bin (user-selectable) */
  color: string;
}

/**
 * Build a material array and configure geometry groups for feature-colored rendering.
 * Returns the materials array, or null if feature coloring is not applicable.
 */
function buildFeatureMaterials(
  faceGroups: readonly FaceGroupData[],
  geometry: THREE.BufferGeometry,
  wireframe: boolean,
  hasPrecomputedNormals: boolean
): THREE.MeshStandardMaterial[] {
  // Map unique tags to sequential material indices
  const tagToIndex = new Map<number, number>();
  const materials: THREE.MeshStandardMaterial[] = [];

  for (const group of faceGroups) {
    let materialIndex = tagToIndex.get(group.tag);
    if (materialIndex === undefined) {
      materialIndex = materials.length;
      tagToIndex.set(group.tag, materialIndex);
      const tagColor = FEATURE_TAG_COLORS[group.tag] ?? FALLBACK_TAG_COLOR;
      materials.push(
        new THREE.MeshStandardMaterial({
          color: tagColor,
          roughness: 0.45,
          metalness: 0,
          wireframe,
          side: THREE.DoubleSide,
          emissive: new THREE.Color(tagColor),
          emissiveIntensity: 0.08,
          flatShading: !hasPrecomputedNormals,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        })
      );
    }
    geometry.addGroup(group.start, group.count, materialIndex);
  }

  return materials;
}

export function BinMesh({ wireframe, color }: BinMeshProps) {
  const { invalidate } = useThree();
  const { vertices, normals, indices, edgeVertices, faceGroups } = useDesignerStore(
    useShallow((s) => ({
      vertices: s.generation.mesh?.vertices ?? null,
      normals: s.generation.mesh?.normals ?? null,
      indices: s.generation.mesh?.indices ?? null,
      edgeVertices: s.generation.mesh?.edgeVertices ?? null,
      faceGroups: s.generation.mesh?.faceGroups ?? null,
    }))
  );

  const featureColorPreview = useSettingsStore((s) => s.settings.featureColorPreview);

  // Check if we have precomputed normals (small bins/export) or empty (large bins)
  const hasPrecomputedNormals = normals && normals.length > 0;

  const useFeatureColors = featureColorPreview && faceGroups !== null && faceGroups.length > 0;

  const geometry = useMemo(() => {
    if (!vertices || vertices.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    if (indices && indices.length > 0) {
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
    }

    if (hasPrecomputedNormals) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    } else {
      // Compute normals for flat shading
      geo.computeVertexNormals();
    }

    return geo;
  }, [vertices, normals, indices, hasPrecomputedNormals]);

  // Build feature materials when feature color mode is active
  const featureMaterials = useMemo(() => {
    if (!useFeatureColors || !geometry) return null;

    // Clear any existing groups before adding new ones
    geometry.clearGroups();
    return buildFeatureMaterials(faceGroups, geometry, wireframe, !!hasPrecomputedNormals);
  }, [useFeatureColors, geometry, faceGroups, wireframe, hasPrecomputedNormals]);

  // Create edge geometry from pre-computed BREP topology edges (computed in worker)
  const edgesGeometry = useMemo(() => {
    if (!edgeVertices || edgeVertices.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3));
    return geo;
  }, [edgeVertices]);

  // Dispose old geometry on unmount or change
  useEffect(() => {
    return () => {
      geometry?.dispose();
      edgesGeometry?.dispose();
    };
  }, [geometry, edgesGeometry]);

  // Dispose feature materials on unmount or change
  useEffect(() => {
    return () => {
      if (featureMaterials) {
        for (const mat of featureMaterials) {
          mat.dispose();
        }
      }
    };
  }, [featureMaterials]);

  // Invalidate frame when mesh data changes
  useEffect(() => {
    if (geometry) invalidate();
  }, [geometry, invalidate]);

  // Invalidate frame when visual props change
  useEffect(() => {
    invalidate();
  }, [wireframe, color, featureColorPreview, invalidate]);

  if (!geometry) return null;

  return (
    <>
      {featureMaterials ? (
        <mesh geometry={geometry} material={featureMaterials} position={[0, 0, 0.1]} />
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
            flatShading={!hasPrecomputedNormals}
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
