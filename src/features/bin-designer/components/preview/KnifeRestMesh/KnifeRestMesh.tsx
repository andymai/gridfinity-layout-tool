/**
 * Renders the knife block's companion handle rest beside the block in the 3D
 * preview, shown mated because the pair is the object being designed — a
 * block with knife slots and no rest reads as a knife with nowhere to lie.
 *
 * The rest's mesh arrives in its OWN print frame (Z=0 at its bottom, XY
 * centred on its own footprint), so unlike the detachable feet it needs a
 * placement. That placement is `knifeRestGroupPosition`, which routes the step
 * through the shared plan rather than re-deriving it here.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { planKnifeRest } from '@/shared/utils/knifeRestPlan';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';
import { knifeRestGroupPosition } from './knifeRestPlacement';

/** Solid enough to read as its own printed part, matching the other companions. */
const BASE_OPACITY = 0.92;

/** Matches LidMesh so every companion part ghosts together under xray. */
const XRAY_OPACITY_FACTOR = 0.32;

interface KnifeRestMeshProps {
  color: string;
  /** Extra separation from the block along the exit axis, in mm. 0 = mated. */
  offsetMm: number;
  wireframe?: boolean;
  xray?: boolean;
}

export function KnifeRestMesh({
  color,
  offsetMm,
  wireframe = false,
  xray = false,
}: KnifeRestMeshProps) {
  const { invalidate } = useThree();

  const { restMesh, params } = useDesignerStore(
    useShallow((s) => ({
      restMesh: s.generation.mesh?.knifeRestMesh ?? null,
      params: s.params,
    }))
  );

  const plan = useMemo(() => planKnifeRest(params), [params]);

  // The rest is its own printed part, so it takes its own filament colour when
  // the design names one.
  const restColor = params.knifeRest?.color ?? color;

  const { geometry, edgesGeometry, hasPrecomputedNormals } = useMeshGeometry({
    vertices: restMesh?.vertices ?? null,
    normals: restMesh?.normals ?? null,
    indices: restMesh?.indices ?? null,
    edgeVertices: restMesh?.edgeVertices ?? null,
  });

  const matProps = useMemo(
    () => ({
      color: restColor,
      roughness: 0.45,
      metalness: 0,
      wireframe,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: xray ? BASE_OPACITY * XRAY_OPACITY_FACTOR : BASE_OPACITY,
      depthWrite: !xray,
      flatShading: !hasPrecomputedNormals,
    }),
    [restColor, wireframe, hasPrecomputedNormals, xray]
  );

  const position = useMemo(
    () => (plan ? knifeRestGroupPosition(params, plan, offsetMm) : null),
    [params, plan, offsetMm]
  );

  useEffect(() => {
    invalidate();
  }, [geometry, position, invalidate]);

  if (!geometry || !position) return null;

  return (
    <group position={position}>
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
