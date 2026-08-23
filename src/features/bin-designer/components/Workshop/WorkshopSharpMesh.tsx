/**
 * The worker's exact fused assembly, swapped in over the proxies once
 * generation settles. Arrives in the print frame (XY centered, Z=0 at the
 * printable bottom) and is dropped by socket + floor so it lands in the
 * scene frame (z=0 = floor top). A brief emissive settle marks the swap —
 * the hologram resolving to solid.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { MeshStandardMaterial } from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';

const RESOLVE_MS = 250;

interface WorkshopSharpMeshProps {
  floorThickness: number;
}

export function WorkshopSharpMesh({ floorThickness }: WorkshopSharpMeshProps) {
  const colors = useThreeColors();
  const reducedMotion = usePrefersReducedMotion();
  const mesh = useDesignerStore(
    useShallow((s) => ({
      vertices: s.generation.mesh?.vertices ?? null,
      normals: s.generation.mesh?.normals ?? null,
      indices: s.generation.mesh?.indices ?? null,
      edgeVertices: s.generation.mesh?.edgeVertices ?? null,
    }))
  );
  const { geometry, edgesGeometry } = useMeshGeometry(mesh);
  const materialRef = useRef<MeshStandardMaterial>(null);
  const settleStartRef = useRef<number | null>(null);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!geometry) return;
    settleStartRef.current = reducedMotion ? null : performance.now();
    invalidate();
  }, [geometry, invalidate, reducedMotion]);

  useFrame(() => {
    const material = materialRef.current;
    const start = settleStartRef.current;
    if (!material || start === null) return;
    const t = (performance.now() - start) / RESOLVE_MS;
    if (t >= 1) {
      material.emissiveIntensity = 0;
      settleStartRef.current = null;
      invalidate();
      return;
    }
    material.emissiveIntensity = 0.5 * (1 - t);
    invalidate();
  });

  if (!geometry) return null;
  const zDrop = -(GRIDFINITY_SPEC.SOCKET_HEIGHT + floorThickness);

  return (
    <group position={[0, 0, zDrop]}>
      <mesh geometry={geometry} raycast={() => null}>
        <meshStandardMaterial
          ref={materialRef}
          color={colors.workshopPart}
          roughness={0.55}
          metalness={0.1}
          emissive={colors.workshopGhost}
          emissiveIntensity={0}
        />
      </mesh>
      {edgesGeometry && (
        <lineSegments geometry={edgesGeometry} raycast={() => null}>
          <lineBasicMaterial color={colors.lineColor} transparent opacity={colors.lineOpacity} />
        </lineSegments>
      )}
    </group>
  );
}
