/**
 * The slanted bin's end support, standing where it prints: on the cells past
 * the bin's footprint, under the leaning top. The worker builds its preview
 * mesh in the bin's own frame, so it shares the bin's ground-plane nudge and
 * needs no placement of its own.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { planSlantSupport } from '@/shared/utils/slantPlan';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';
import { PREVIEW_Z_OFFSET } from '../LidMesh/lidAnchorZ';

const BASE_OPACITY = 0.92;
/** Matches the other companions so every separate part ghosts together under xray. */
const XRAY_OPACITY_FACTOR = 0.32;
const POSITION: [number, number, number] = [0, 0, PREVIEW_Z_OFFSET];

interface SlantSupportMeshProps {
  color: string;
  wireframe?: boolean;
  xray?: boolean;
}

export function SlantSupportMesh({
  color,
  wireframe = false,
  xray = false,
}: SlantSupportMeshProps) {
  const { invalidate } = useThree();
  const { supportMesh, params } = useDesignerStore(
    useShallow((s) => ({
      supportMesh: s.generation.mesh?.slantSupportMesh ?? null,
      params: s.params,
    }))
  );
  // The mesh outlives the params that built it by one generation; a support
  // the design no longer asks for must not linger in the meantime.
  const planned = useMemo(() => planSlantSupport(params) !== null, [params]);

  const { geometry, edgesGeometry, hasPrecomputedNormals } = useMeshGeometry({
    vertices: supportMesh?.vertices ?? null,
    normals: supportMesh?.normals ?? null,
    indices: supportMesh?.indices ?? null,
    edgeVertices: supportMesh?.edgeVertices ?? null,
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
  }, [geometry, invalidate]);

  if (!geometry || !planned) return null;

  return (
    <group position={POSITION}>
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
