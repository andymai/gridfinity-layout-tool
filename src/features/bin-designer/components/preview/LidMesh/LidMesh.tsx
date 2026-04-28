/**
 * Renders the click-lock lid mesh in the 3D preview.
 *
 * Coordinate alignment when snapped onto the bin:
 *   - The lid is built in lid-local coords with Y = 0 at the lid floor's
 *     TOP surface and Y = anchorZ (≈ -2.1mm) at the lid's mating-cavity
 *     opening — i.e., the line that should line up with the bin's stacking
 *     lip top when the lid is mated.
 *   - When snapped: lid local Y = anchorZ aligns with the bin's lip top
 *     (world Z = totalHeight + PREVIEW_Z_OFFSET). The lid floor top sits
 *     |anchorZ| (~2.1mm) ABOVE the bin's lip top, with the mating cavity
 *     wrapping the lip from there down.
 *   - Exploded views add `lidOffsetMm` on top of the snapped position.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useShallow } from 'zustand/react/shallow';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { LID_FIT_CLEARANCE } from '@/features/bin-designer/types';

/** Z offset BinMesh applies to its rendered group — keep the lid in lockstep. */
const PREVIEW_Z_OFFSET = 0.1;

/** Extra clearance baked into the anchor calculation (matches lidConstants.LID_EXTRA_HEIGHT). */
const LID_EXTRA_HEIGHT = 0.2;

/**
 * Anchor Z in lid-local coords — the Y position where the lid's mating
 * cavity opens up to meet the bin's stacking lip when snapped.
 * Mirrors `lidAnchorZ()` in lidConstants.ts (worker-side, can't import).
 */
function lidAnchorZ(heightUnitMm: number, fitClearance: number): number {
  return -heightUnitMm - LID_EXTRA_HEIGHT + GRIDFINITY.LIP_HEIGHT + Math.SQRT2 * fitClearance * 2;
}

interface LidMeshProps {
  /** Base color for the lid (matches bin material). */
  color: string;
  /** Hide the lid even when generated. */
  visible: boolean;
  /** When true, lid sits on the lip; when false, lift by EXPLODED_LIFT_MM. */
  snapped: boolean;
  wireframe?: boolean;
}

/** Default lift between bin and lid in exploded view (mm). */
const EXPLODED_LIFT_MM = 5;

export function LidMesh({ color, visible, snapped, wireframe = false }: LidMeshProps) {
  const { invalidate } = useThree();

  const { lidMesh, lidGroupZ } = useDesignerStore(
    useShallow((s) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive fallback for legacy params
      const heightUnit = s.params.heightUnitMm ?? 7;
      const fitClearance = LID_FIT_CLEARANCE[s.params.lid.fit];
      // Bin's lip top in world Z (after the bin's translateStage moves Z=0
      // to baseplate top, plus the PREVIEW_Z_OFFSET BinMesh adds).
      const binLipTopWorldZ = s.params.height * heightUnit + PREVIEW_Z_OFFSET;
      // The lid's group must be positioned so lid local Y = anchorZ aligns
      // with binLipTopWorldZ. Since rendering at group position P puts lid
      // Y=0 at world Z=P, we need P = binLipTopWorldZ - anchorZ. anchorZ is
      // negative (~-2.1), so this lifts the group by ~2.1mm above the lip.
      const anchorZ = lidAnchorZ(heightUnit, fitClearance);
      return {
        lidMesh: s.generation.mesh?.lidMesh ?? null,
        lidGroupZ: binLipTopWorldZ - anchorZ,
      };
    })
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
  const positionZ = lidGroupZ + liftZ;

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
