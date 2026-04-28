/**
 * Renders the click-lock lid mesh in the 3D preview.
 *
 * Coordinate alignment when snapped onto the bin:
 *   - The lid is built in lid-local coords with Y = 0 at the lid floor's
 *     TOP surface and Y = anchorZ (≈ -2.1mm) at the lid's mating-cavity
 *     opening — i.e., the line that should line up with the bin's stacking
 *     lip top when the lid is mated.
 *   - When snapped (lidOffsetMm = 0): lid local Y = anchorZ aligns with the
 *     bin's lip top (world Z = totalHeight + PREVIEW_Z_OFFSET). The lid
 *     floor top sits |anchorZ| (~2.1mm) ABOVE the bin's lip top, with the
 *     mating cavity wrapping the lip from there down.
 *   - Exploded views add `lidOffsetMm` on top of the snapped position.
 *
 * Opacity:
 *   - When closed (offset ≤ 2mm): 70% opacity — the lid reads as a solid
 *     part while still allowing a hint of the bin's interior through.
 *   - When exploded (offset > 5mm): 95% opacity (effectively solid; the
 *     bin is plainly visible alongside).
 *   - Linear interpolation between 2mm and 5mm.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useShallow } from 'zustand/react/shallow';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';
import { LID_FIT_CLEARANCE } from '@/features/bin-designer/types';
import { lidAnchorZ } from './lidAnchorZ';

/** Z offset BinMesh applies to its rendered group — keep the lid in lockstep. */
const PREVIEW_Z_OFFSET = 0.1;

/** Opacity bands for closed vs exploded views. */
const OPACITY_CLOSED = 0.7;
const OPACITY_OPEN = 0.95;
const OPACITY_INTERP_START_MM = 2;
const OPACITY_INTERP_END_MM = 5;

/** Linear interpolation: 30% closed → 70% open over [2mm, 5mm]. */
function opacityForOffset(offsetMm: number): number {
  if (offsetMm <= OPACITY_INTERP_START_MM) return OPACITY_CLOSED;
  if (offsetMm >= OPACITY_INTERP_END_MM) return OPACITY_OPEN;
  const t =
    (offsetMm - OPACITY_INTERP_START_MM) / (OPACITY_INTERP_END_MM - OPACITY_INTERP_START_MM);
  return OPACITY_CLOSED + t * (OPACITY_OPEN - OPACITY_CLOSED);
}

interface LidMeshProps {
  /** Base color for the lid (matches bin material). */
  color: string;
  /** Distance the lid is lifted above its mated position, in mm. 0 = closed. */
  lidOffsetMm: number;
  wireframe?: boolean;
  /**
   * Called when the pointer enters/leaves the lid mesh. Used to drive a
   * paired highlight on the bin (so users see which two parts mate).
   */
  onHoverChange?: (hovered: boolean) => void;
}

export function LidMesh({ color, lidOffsetMm, wireframe = false, onHoverChange }: LidMeshProps) {
  const { invalidate } = useThree();
  const [hovered, setHovered] = useState(false);

  const { lidMesh, lidGroupZ } = useDesignerStore(
    useShallow((s) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive fallback for legacy params
      const heightUnit = s.params.heightUnitMm ?? 7;
      const fitClearance = LID_FIT_CLEARANCE[s.params.lid.fit];
      const binLipTopWorldZ = s.params.height * heightUnit + PREVIEW_Z_OFFSET;
      const anchorZ = lidAnchorZ(heightUnit, fitClearance);
      return {
        lidMesh: s.generation.mesh?.lidMesh ?? null,
        // Snapped position: lid Y=anchor sits at bin lip top, so the lid
        // group (where Y=0 lands) is binLipTopWorldZ - anchorZ. anchorZ is
        // negative, so this lifts the group ~2.1mm above the lip.
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

  const matProps = useMemo(
    () => ({
      color,
      roughness: 0.45,
      metalness: 0,
      wireframe,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: opacityForOffset(lidOffsetMm),
      flatShading: !hasPrecomputedNormals,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      // On hover, brighten the lid emissively so it visually pairs with the
      // bin (which boosts its emissive in response — see BinMesh's lidHovered).
      emissive: new THREE.Color(color),
      emissiveIntensity: hovered ? 0.4 : 0.08,
    }),
    [color, wireframe, hasPrecomputedNormals, lidOffsetMm, hovered]
  );

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHovered(true);
      onHoverChange?.(true);
    },
    [onHoverChange]
  );

  const handlePointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHovered(false);
      onHoverChange?.(false);
    },
    [onHoverChange]
  );

  // Invalidate the R3F frame whenever any visual input changes (geometry,
  // offset-driven opacity, or hover-driven emissive intensity).
  useEffect(() => {
    invalidate();
  }, [geometry, lidOffsetMm, hovered, invalidate]);

  if (!geometry) return null;

  const positionZ = lidGroupZ + lidOffsetMm;

  return (
    <group position={[0, 0, positionZ]}>
      <mesh geometry={geometry} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
        <meshStandardMaterial {...matProps} />
      </mesh>
      {!wireframe && edgesGeometry && (
        <lineSegments geometry={edgesGeometry} renderOrder={1}>
          <lineBasicMaterial
            color="#000000"
            depthTest={true}
            transparent
            opacity={Math.min(0.5, opacityForOffset(lidOffsetMm) + 0.2)}
          />
        </lineSegments>
      )}
    </group>
  );
}
