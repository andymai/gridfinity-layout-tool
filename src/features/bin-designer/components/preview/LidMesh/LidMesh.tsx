/**
 * Renders the click-lock lid mesh in the 3D preview.
 *
 * The lid is built in lid-local coords (Z=0 = top of bin's stacking lip
 * when snapped). This component translates it into world space alongside
 * the bin and applies an exploded-view lift when not snapped.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useShallow } from 'zustand/react/shallow';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';

/** Default lift between bin and lid in exploded view (mm). */
const EXPLODED_LIFT_MM = 5;

interface LidMeshProps {
  /** Base color for the lid (matches bin material). */
  color: string;
  /** Hide the lid even when generated. */
  visible: boolean;
  /** When true, lid sits on the lip; when false, lift by EXPLODED_LIFT_MM. */
  snapped: boolean;
  wireframe?: boolean;
}

export function LidMesh({ color, visible, snapped, wireframe = false }: LidMeshProps) {
  const { invalidate } = useThree();

  const { lidMesh, lipTopZ } = useDesignerStore(
    useShallow((s) => ({
      lidMesh: s.generation.mesh?.lidMesh ?? null,
      // Bin's lip top in world space (after the bin's translateStage moves
      // Z=0 to baseplate top): totalHeight = height × heightUnitMm. The lid's
      // local Z=0 is the lip's top surface when snapped, so we render the lid
      // at world Z = totalHeight.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive fallback for legacy params
      lipTopZ: s.params.height * (s.params.heightUnitMm ?? 7),
    }))
  );

  const { geometry, edgesGeometry, hasPrecomputedNormals } = useMeshGeometry({
    vertices: lidMesh?.vertices ?? null,
    normals: lidMesh?.normals ?? null,
    indices: lidMesh?.indices ?? null,
    edgeVertices: lidMesh?.edgeVertices ?? null,
  });

  useEffect(() => {
    if (geometry) invalidate();
  }, [geometry, invalidate]);

  const matProps = useMemo(
    () => ({
      color,
      roughness: 0.45,
      metalness: 0,
      wireframe,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
      flatShading: !hasPrecomputedNormals,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
    [color, wireframe, hasPrecomputedNormals]
  );

  if (!visible || !geometry) return null;

  const liftZ = snapped ? 0 : EXPLODED_LIFT_MM;
  const positionZ = lipTopZ + liftZ;

  return (
    <group position={[0, 0, positionZ]}>
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
