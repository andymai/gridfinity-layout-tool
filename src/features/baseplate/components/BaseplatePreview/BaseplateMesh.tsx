import { useRef, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import type * as THREE from 'three';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { MESH_MATERIAL_PROPS, EDGE_MATERIAL_PROPS } from './materialProps';
import { useMeshGeometry } from './useMeshGeometry';
import { easeOutCubic } from './cameraUtils';

/** Duration of geometry crossfade in milliseconds. */
const CROSSFADE_MS = 300;

interface FadeSnapshot {
  oldGeo: THREE.BufferGeometry;
  oldEdges: THREE.BufferGeometry | null;
  oldNormals: boolean;
}

export function BaseplateMesh({ color }: { color: string }) {
  const { invalidate } = useThree();
  const meshArrays = useBaseplatePageStore(
    useShallow((s) => ({
      vertices: s.generation.mesh?.vertices ?? null,
      normals: s.generation.mesh?.normals ?? null,
      indices: s.generation.mesh?.indices ?? null,
      edgeVertices: s.generation.mesh?.edgeVertices ?? null,
    }))
  );

  const { geometry, edgesGeometry, hasPrecomputedNormals } = useMeshGeometry(meshArrays);

  // Crossfade: fade snapshot is state (safe for render), timing is ref (for useFrame)
  const prevGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const prevEdgesRef = useRef<THREE.BufferGeometry | null>(null);
  const prevNormalsRef = useRef(false);
  const fadeStartRef = useRef<number | null>(null);
  const [fadeSnapshot, setFadeSnapshot] = useState<FadeSnapshot | null>(null);
  const [fadeOpacity, setFadeOpacity] = useState(1);

  useEffect(() => {
    if (geometry && prevGeoRef.current && prevGeoRef.current !== geometry) {
      // Clone old geometries -- originals will be disposed by useMeshGeometry cleanup
      fadeStartRef.current = performance.now();
      setFadeSnapshot({
        oldGeo: prevGeoRef.current.clone(),
        oldEdges: prevEdgesRef.current?.clone() ?? null,
        oldNormals: prevNormalsRef.current,
      });
      setFadeOpacity(0);
    }
    prevGeoRef.current = geometry;
    prevEdgesRef.current = edgesGeometry;
    prevNormalsRef.current = hasPrecomputedNormals;
    invalidate();
  }, [geometry, edgesGeometry, hasPrecomputedNormals, color, invalidate]);

  useFrame(() => {
    if (fadeStartRef.current === null) return;

    const elapsed = performance.now() - fadeStartRef.current;
    const progress = Math.min(elapsed / CROSSFADE_MS, 1);
    const eased = easeOutCubic(progress);

    setFadeOpacity(eased);
    invalidate();

    if (progress >= 1) {
      fadeStartRef.current = null;
      setFadeSnapshot((prev) => {
        // Dispose cloned geometries now that fade is complete
        prev?.oldGeo.dispose();
        prev?.oldEdges?.dispose();
        return null;
      });
    }
  });

  if (!geometry) return null;

  const isFading = fadeSnapshot !== null;

  return (
    <>
      {/* Fading-out old geometry during crossfade */}
      {fadeSnapshot && (
        <>
          <mesh geometry={fadeSnapshot.oldGeo} position={[0, 0, 0.1]}>
            <meshStandardMaterial
              {...MESH_MATERIAL_PROPS}
              color={color}
              emissive={color}
              flatShading={!fadeSnapshot.oldNormals}
              transparent
              opacity={1 - fadeOpacity}
            />
          </mesh>
          {fadeSnapshot.oldEdges && (
            <lineSegments geometry={fadeSnapshot.oldEdges} position={[0, 0, 0.1]} renderOrder={1}>
              <lineBasicMaterial {...EDGE_MATERIAL_PROPS} transparent opacity={1 - fadeOpacity} />
            </lineSegments>
          )}
        </>
      )}

      {/* Current geometry -- fading in during crossfade, opaque otherwise */}
      <mesh geometry={geometry} position={[0, 0, 0.1]}>
        <meshStandardMaterial
          {...MESH_MATERIAL_PROPS}
          color={color}
          emissive={color}
          flatShading={!hasPrecomputedNormals}
          transparent={isFading}
          opacity={fadeOpacity}
        />
      </mesh>
      {edgesGeometry && (
        <lineSegments geometry={edgesGeometry} position={[0, 0, 0.1]} renderOrder={1}>
          <lineBasicMaterial
            {...EDGE_MATERIAL_PROPS}
            transparent={isFading}
            opacity={isFading ? fadeOpacity : 1}
          />
        </lineSegments>
      )}
    </>
  );
}
