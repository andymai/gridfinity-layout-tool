/**
 * Renders a socket-mode bin's swappable label plates in the 3D preview.
 *
 * Each plate is drawn twice from one mesh:
 *   - **Seated** in its socket, sliding out along the shelf's own protrusion
 *     direction as the explode slider opens — the same control that lifts the
 *     lid, so one slider separates every companion part.
 *   - **In a reference row** beside the bin at `REFERENCE_GAP`, matching where
 *     `GhostDividerPieces` parks its reference divider so a bin with both puts
 *     its loose parts in one place. The row is static: it is an exhibit of what
 *     gets printed, not part of the assembly.
 *
 * The worker meshes plates in plate-local coordinates (centred on the origin,
 * bottom on Z=0) and reports each seated pose, so both draws reuse one geometry.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';
import type { LabelPlateMeshData } from '@/shared/types/generation';
import { referenceRowPoses, seatedPose } from './platePoses';
import type { Pose } from './platePoses';

/** Stable empty reference so an absent set doesn't churn memo identities. */
const EMPTY_PLATES: readonly LabelPlateMeshData[] = [];

interface LabelPlateMeshesProps {
  readonly color: string;
  /** Shared explode offset; 0 = fully assembled. */
  readonly lidOffsetMm: number;
  readonly wireframe?: boolean;
}

/**
 * One plate's geometry, drawn at each pose it occupies — seated, and again in
 * the reference row. Both draws share a single `BufferGeometry`; instantiating
 * this component per pose would build the same tessellated buffers twice for
 * no visual difference.
 */
function PlateInstance({
  plate,
  poses,
  material,
}: {
  plate: LabelPlateMeshData;
  poses: readonly Pose[];
  material: THREE.Material;
}) {
  const { geometry } = useMeshGeometry({
    vertices: plate.vertices,
    normals: plate.normals,
    indices: plate.indices,
    edgeVertices: null,
    faceGroups: undefined,
  });

  if (!geometry) return null;
  return (
    <>
      {poses.map((pose, i) => (
        <mesh
          key={i}
          geometry={geometry}
          material={material}
          position={pose.position}
          rotation={[0, 0, (pose.yawDeg * Math.PI) / 180]}
          renderOrder={2}
        />
      ))}
    </>
  );
}

export function LabelPlateMeshes({ color, lidOffsetMm, wireframe = false }: LabelPlateMeshesProps) {
  const { labelPlates, depth, gridUnitMm, gridUnitMmY } = useDesignerStore(
    useShallow((s) => ({
      labelPlates: s.generation.mesh?.labelPlates ?? null,
      depth: s.params.depth,
      gridUnitMm: s.params.gridUnitMm,
      gridUnitMmY: s.params.gridUnitMmY,
    }))
  );

  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, wireframe }),
    [color, wireframe]
  );

  // Without this, every colour or wireframe change strands the previous
  // material on the GPU for the rest of the editing session.
  useEffect(() => () => material.dispose(), [material]);

  const plates = useMemo(() => labelPlates?.plates ?? EMPTY_PLATES, [labelPlates]);

  // Reference row: laid out along X beside the bin, parked beyond its back
  // face so it reads as a set sitting next to the part it belongs to.
  const rowPositions = useMemo(
    () => referenceRowPoses(plates, depth * (gridUnitMmY ?? gridUnitMm) - GRIDFINITY.TOLERANCE),
    [plates, depth, gridUnitMm, gridUnitMmY]
  );

  if (plates.length === 0) return null;

  return (
    <group>
      {plates.map((plate, i) => (
        <PlateInstance
          key={i}
          plate={plate}
          poses={[seatedPose(plate, lidOffsetMm), rowPositions[i]]}
          material={material}
        />
      ))}
    </group>
  );
}
