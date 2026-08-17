/**
 * Renders the detachable feet under the bin in the 3D preview.
 *
 * Shown assembled, where they end up, because that is the object being
 * designed: a flat-bottomed body on its own reads as a bin missing its base,
 * and the whole question the mode raises — does this still look like a
 * Gridfinity bin — is only answerable with the feet in place.
 *
 * The feet arrive already positioned in the bin's own build frame (the body's
 * floor sits at Z=0 and the feet hang below it), so nothing here re-derives a
 * seat plane. The explode slider drops them further, which is what makes it
 * legible that they are separate parts rather than part of the body.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';

/** Solid enough to read as its own printed part, matching the other companions. */
const BASE_OPACITY = 0.92;

/** Matches LidMesh so every companion part ghosts together under xray. */
const XRAY_OPACITY_FACTOR = 0.32;

interface DetachableFeetMeshProps {
  color: string;
  /**
   * Distance the explode slider lifts the lid. The feet move the opposite way —
   * down, away from the bin — because that is the direction they come off in.
   */
  lidOffsetMm: number;
  wireframe?: boolean;
  xray?: boolean;
}

export function DetachableFeetMesh({
  color,
  lidOffsetMm,
  wireframe = false,
  xray = false,
}: DetachableFeetMeshProps) {
  const { invalidate } = useThree();

  const feetMesh = useDesignerStore(
    useShallow((s) => s.generation.mesh?.detachableFeetMesh ?? null)
  );

  const { geometry, edgesGeometry, hasPrecomputedNormals } = useMeshGeometry({
    vertices: feetMesh?.vertices ?? null,
    normals: feetMesh?.normals ?? null,
    indices: feetMesh?.indices ?? null,
    edgeVertices: feetMesh?.edgeVertices ?? null,
  });

  const matProps = useMemo(
    () => ({
      color,
      roughness: 0.45,
      metalness: 0,
      wireframe,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: xray ? BASE_OPACITY * XRAY_OPACITY_FACTOR : BASE_OPACITY,
      depthWrite: !xray,
      flatShading: !hasPrecomputedNormals,
    }),
    [color, wireframe, hasPrecomputedNormals, xray]
  );

  useEffect(() => {
    invalidate();
  }, [geometry, lidOffsetMm, invalidate]);

  if (!geometry || !feetMesh) return null;

  return (
    <group position={[0, 0, -lidOffsetMm]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial {...matProps} />
      </mesh>
      {!wireframe && edgesGeometry && (
        <lineSegments geometry={edgesGeometry} renderOrder={1}>
          <lineBasicMaterial color="#000000" depthTest={true} transparent opacity={0.5} />
        </lineSegments>
      )}
    </group>
  );
}
