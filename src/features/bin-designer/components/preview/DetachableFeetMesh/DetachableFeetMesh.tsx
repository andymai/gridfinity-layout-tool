/**
 * Renders the detachable feet under the bin in the 3D preview, shown assembled
 * because that is the object being designed — a flat-bottomed body on its own
 * reads as a bin missing its base.
 *
 * The feet arrive already positioned in the bin's own build frame (the body's
 * floor sits at Z=0 and the feet hang below it), so nothing here re-derives a
 * seat plane: that is how a preview and an export come to disagree.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { getZoneColor } from '@/features/bin-designer/types/featureColors';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';

/** Solid enough to read as its own printed part, matching the other companions. */
const BASE_OPACITY = 0.92;

/** Matches LidMesh so every companion part ghosts together under xray. */
const XRAY_OPACITY_FACTOR = 0.32;

interface DetachableFeetMeshProps {
  color: string;
  /** How far the feet are dropped away from the bin, in mm. 0 = attached. */
  offsetMm: number;
  wireframe?: boolean;
  xray?: boolean;
}

export function DetachableFeetMesh({
  color,
  offsetMm,
  wireframe = false,
  xray = false,
}: DetachableFeetMeshProps) {
  const { invalidate } = useThree();

  const { feetMesh, featureColors } = useDesignerStore(
    useShallow((s) => ({
      feetMesh: s.generation.mesh?.detachableFeetMesh ?? null,
      featureColors: s.params.featureColors,
    }))
  );

  // The feet ARE the bin's base, so in multi-colour mode they take the Base
  // zone rather than the body colour — otherwise the one control that should
  // paint them does nothing, in the preview and in the printed 3MF alike.
  const feetColor = featureColors.enabled ? getZoneColor(featureColors, 'base') : color;

  const { geometry, edgesGeometry, hasPrecomputedNormals } = useMeshGeometry({
    vertices: feetMesh?.vertices ?? null,
    normals: feetMesh?.normals ?? null,
    indices: feetMesh?.indices ?? null,
    edgeVertices: feetMesh?.edgeVertices ?? null,
  });

  const matProps = useMemo(
    () => ({
      color: feetColor,
      roughness: 0.45,
      metalness: 0,
      wireframe,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: xray ? BASE_OPACITY * XRAY_OPACITY_FACTOR : BASE_OPACITY,
      depthWrite: !xray,
      flatShading: !hasPrecomputedNormals,
    }),
    [feetColor, wireframe, hasPrecomputedNormals, xray]
  );

  useEffect(() => {
    invalidate();
  }, [geometry, offsetMm, invalidate]);

  if (!geometry) return null;

  return (
    <group position={[0, 0, -offsetMm]}>
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
