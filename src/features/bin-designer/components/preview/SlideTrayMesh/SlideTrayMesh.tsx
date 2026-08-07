/**
 * Renders the sliding tray seated on its rail in the 3D preview.
 *
 * The tray is BUILT floor-down at the origin, which is its print orientation.
 * Seating it is this component's job: the resolver reports `restZ` in the bin's
 * own (box) frame, and the world position is that plus the base offset, the
 * same conversion `LidMesh` makes for the lip top.
 *
 * Showing it in place rather than beside the bin is deliberate. The mechanism
 * is the whole point of the feature, and how far the tray stands proud of the
 * rim is a real trap: a rail dropped too little leaves the tray sticking out of
 * the bin, which is only obvious when you can see it sitting there.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';
import { baseFloorZ } from '@/features/bin-designer/utils/binDimensions';

/** Solid enough to read as its own printed part, like the stack plate. */
const BASE_OPACITY = 0.92;

/** Matches LidMesh so companion parts ghost together under xray. */
const XRAY_OPACITY_FACTOR = 0.32;

interface SlideTrayMeshProps {
  color: string;
  /**
   * Distance the lid is lifted by the explode slider. The tray rides it too, so
   * one control opens the whole assembly instead of leaving the tray buried
   * while everything above it lifts away.
   */
  lidOffsetMm: number;
  wireframe?: boolean;
  xray?: boolean;
}

export function SlideTrayMesh({
  color,
  lidOffsetMm,
  wireframe = false,
  xray = false,
}: SlideTrayMeshProps) {
  const { invalidate } = useThree();

  const { slideTrayMesh, floorZ } = useDesignerStore(
    useShallow((s) => ({
      slideTrayMesh: s.generation.mesh?.slideTrayMesh ?? null,
      floorZ: baseFloorZ(s.params.base, s.params.heightUnitMm, s.params.lid),
    }))
  );

  const { geometry, edgesGeometry, hasPrecomputedNormals } = useMeshGeometry({
    vertices: slideTrayMesh?.vertices ?? null,
    normals: slideTrayMesh?.normals ?? null,
    indices: slideTrayMesh?.indices ?? null,
    edgeVertices: slideTrayMesh?.edgeVertices ?? null,
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

  if (!geometry || !slideTrayMesh) return null;

  return (
    <group position={[0, 0, floorZ + slideTrayMesh.restZ + lidOffsetMm]}>
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
