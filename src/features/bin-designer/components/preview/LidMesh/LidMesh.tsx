/**
 * Renders the click-lock lid mesh in the 3D preview.
 *
 * Coordinate alignment when "closed" (lidOffsetMm = 0):
 *   - The lid is built in lid-local coords with Z = 0 at the floor's
 *     TOP surface and Z = anchorZ (~-2.1mm) at the mating-cavity opening,
 *     which lines up with the bin's stacking lip top.
 *   - The mating cavity opening sits at the lip top world Z; the floor's
 *     outer face sits ~2.1mm above, with the rails wrapping the lip from
 *     outside. This matches how the printed lid sits on the bin.
 *   - `lidOffsetMm` lifts the lid above this mated position to expose
 *     the cavity for inspection.
 *
 * Opacity:
 *   - Closed (offset ≤ 2mm): 70% — the lid reads as a solid part while
 *     hinting at the bin's interior.
 *   - Exploded (offset > 5mm): 95% — effectively solid; bin visible alongside.
 *   - Linear interpolation between 2mm and 5mm.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useShallow } from 'zustand/react/shallow';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';
import { LID_FIT_CLEARANCE } from '@/features/bin-designer/types';
import { binLipTopWorldZ, lidAnchorZ } from './lidAnchorZ';

/** Opacity bands for closed vs exploded views. */
const OPACITY_CLOSED = 0.7;
const OPACITY_OPEN = 0.95;
const OPACITY_INTERP_START_MM = 2;
const OPACITY_INTERP_END_MM = 5;

/**
 * Multiplier applied to the lid's computed opacity when xray is active so the
 * lid drops to ~30% at the open end and ~21% at the closed end — composes with
 * the explode-driven opacity instead of overwriting it.
 */
const XRAY_OPACITY_FACTOR = 0.32;

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
  /** When true, ghost the lid further so the bin interior is visible through it. */
  xray?: boolean;
}

export function LidMesh({ color, lidOffsetMm, wireframe = false, xray = false }: LidMeshProps) {
  const { invalidate } = useThree();

  const { lidMesh, lidGroupZ } = useDesignerStore(
    useShallow((s) => {
      const { height, heightUnitMm, base } = s.params;
      const lipTopZ = binLipTopWorldZ(height, heightUnitMm, base.stackingLip);
      const anchorZ = lidAnchorZ(heightUnitMm, LID_FIT_CLEARANCE);
      return {
        lidMesh: s.generation.mesh?.lidMesh ?? null,
        // Mated position: lid local Z = anchorZ aligns with the bin's
        // lip top. The lid group (where local Z=0 lands) is then
        // lipTopZ - anchorZ; anchorZ is negative, so the lid floor sits
        // ~2.1mm above the lip with the mating cavity wrapping the lip
        // from outside — true closed state.
        lidGroupZ: lipTopZ - anchorZ,
      };
    })
  );

  const { geometry, edgesGeometry, hasPrecomputedNormals } = useMeshGeometry({
    vertices: lidMesh?.vertices ?? null,
    normals: lidMesh?.normals ?? null,
    indices: lidMesh?.indices ?? null,
    edgeVertices: lidMesh?.edgeVertices ?? null,
  });

  const baseOpacity = opacityForOffset(lidOffsetMm);
  const matProps = useMemo(
    () => ({
      color,
      roughness: 0.45,
      metalness: 0,
      wireframe,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: xray ? baseOpacity * XRAY_OPACITY_FACTOR : baseOpacity,
      depthWrite: !xray,
      flatShading: !hasPrecomputedNormals,
      // Bias the lid's depth values so it consistently loses depth tests
      // against the bin where their surfaces overlap (lid outer wall vs
      // bin lip outer face, separated by only 0.2mm horizontally over the
      // 4.4mm-tall lip Z-range). Without enough bias, those near-coplanar
      // surfaces z-fight at typical preview camera distances. Factor of 4
      // gives clean rendering even at the fully closed offset
      // (LID_OFFSET_MIN = 0) without affecting other view angles.
      polygonOffset: true,
      polygonOffsetFactor: 4,
      polygonOffsetUnits: 4,
    }),
    [color, wireframe, hasPrecomputedNormals, baseOpacity, xray]
  );

  // Invalidate the R3F frame when any visual input changes.
  useEffect(() => {
    invalidate();
  }, [geometry, lidOffsetMm, invalidate]);

  if (!geometry) return null;

  const positionZ = lidGroupZ + lidOffsetMm;

  return (
    <group position={[0, 0, positionZ]}>
      <mesh geometry={geometry}>
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
