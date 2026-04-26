import { useRef, useEffect, useMemo, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import type * as THREE from 'three';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import {
  MESH_MATERIAL_PROPS,
  EDGE_MATERIAL_PROPS,
  PREVIEW_EMISSIVE_INTENSITY,
  desaturateColor,
} from './materialProps';
import { useMeshGeometry } from './useMeshGeometry';
import { easeOutCubic } from './cameraUtils';

/** Duration of geometry crossfade in milliseconds. */
const CROSSFADE_MS = 300;

interface FadeSnapshot {
  oldGeo: THREE.BufferGeometry;
  oldEdges: THREE.BufferGeometry | null;
  oldNormals: boolean;
  // Snapshot the prior material props so the fade-out frame keeps the look the
  // user was seeing (e.g. the desaturated preview tint) instead of popping to
  // the new color for one frame before the crossfade finishes.
  oldColor: string;
  oldEmissiveIntensity: number;
}

export function BaseplateMesh({
  color,
  isPreview = false,
}: {
  color: string;
  isPreview?: boolean;
}) {
  const { invalidate } = useThree();
  // While the direct-mesh preview is on screen, desaturate the user's filament
  // color and drop the emissive so the slab reads as "draft." When BREP swaps
  // in, the existing 300ms crossfade naturally transitions back to full color.
  // Smooth normals + edge wireframes brought the preview close to BREP-quality
  // visually, so we lean into a stronger 0.7 gray-blend (was 0.5) to keep the
  // "this is provisional" cue legible.
  const displayColor = useMemo(
    () => (isPreview ? desaturateColor(color, 0.7) : color),
    [color, isPreview]
  );
  const emissiveIntensity = isPreview
    ? PREVIEW_EMISSIVE_INTENSITY
    : MESH_MATERIAL_PROPS.emissiveIntensity;
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
  const prevColorRef = useRef(displayColor);
  const prevEmissiveRef = useRef(emissiveIntensity);
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
        oldColor: prevColorRef.current,
        oldEmissiveIntensity: prevEmissiveRef.current,
      });
      setFadeOpacity(0);
    }
    prevGeoRef.current = geometry;
    prevEdgesRef.current = edgesGeometry;
    prevNormalsRef.current = hasPrecomputedNormals;
    prevColorRef.current = displayColor;
    prevEmissiveRef.current = emissiveIntensity;
    invalidate();
  }, [geometry, edgesGeometry, hasPrecomputedNormals, displayColor, emissiveIntensity, invalidate]);

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

  // useFrame stops running on unmount, so a fade in progress would leak its
  // cloned BufferGeometry buffers (GPU + CPU). Dispose any in-flight snapshot
  // when the component unmounts.
  useEffect(() => {
    return () => {
      setFadeSnapshot((prev) => {
        prev?.oldGeo.dispose();
        prev?.oldEdges?.dispose();
        return null;
      });
    };
  }, []);

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
              color={fadeSnapshot.oldColor}
              emissive={fadeSnapshot.oldColor}
              emissiveIntensity={fadeSnapshot.oldEmissiveIntensity}
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
          color={displayColor}
          emissive={displayColor}
          emissiveIntensity={emissiveIntensity}
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
