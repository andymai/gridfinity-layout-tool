/**
 * Renders the separate stack-grid baseplate (glue-on companion) in the 3D
 * preview, floating a short distance above the lid so the two-piece split
 * reads at a glance.
 *
 * The slab is built in lid-local coords (Z = 0 at its flat glue face, extending
 * up to the pocket top) — the SAME frame the lid uses. Rendered at the lid's
 * mated group Z it would sit flush on the lid floor; we lift it by
 * `SEPARATE_STACK_PLATE_PREVIEW_GAP_MM` (plus the shared explode offset) to
 * expose the joint. This is a preview affordance only; the exported slab has no
 * such offset (the user glues it flush).
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useShallow } from 'zustand/react/shallow';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';
import { LID_FIT_CLEARANCE } from '@/features/bin-designer/types';
import { getZoneColor } from '@/features/bin-designer/types/featureColors';
import { binLipTopWorldZ, lidAnchorZ } from '../LidMesh/lidAnchorZ';

/** Gap (mm) the baseplate floats above the lid's top in the preview so the
 *  glue joint is visible. Roughly the slab height, so the split reads clearly. */
export const SEPARATE_STACK_PLATE_PREVIEW_GAP_MM = 6;

/** Solid-ish base opacity — the baseplate reads as its own printed part. */
const BASE_OPACITY = 0.92;

/** Matches LidMesh's xray dimming so the pair ghost together consistently. */
const XRAY_OPACITY_FACTOR = 0.32;

interface StackPlateMeshProps {
  /** Fallback color (bin body material), used only when multi-color mode is off;
   *  otherwise the plate follows the lid zone color to match the lid it glues to. */
  color: string;
  /** Distance the lid is lifted above its mated position, in mm. The plate rides
   *  this offset too so it stays above the lid as the explode slider moves. */
  lidOffsetMm: number;
  wireframe?: boolean;
  xray?: boolean;
}

export function StackPlateMesh({
  color,
  lidOffsetMm,
  wireframe = false,
  xray = false,
}: StackPlateMeshProps) {
  const { invalidate } = useThree();

  const { stackPlateMesh, lidGroupZ, featureColors } = useDesignerStore(
    useShallow((s) => {
      const { height, heightUnitMm, base } = s.params;
      const lipTopZ = binLipTopWorldZ(height, heightUnitMm, base.stackingLip);
      const anchorZ = lidAnchorZ(heightUnitMm, LID_FIT_CLEARANCE);
      return {
        stackPlateMesh: s.generation.mesh?.stackPlateMesh ?? null,
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors is typed required but legacy persisted configs may omit it
        featureColors: s.params.featureColors ?? null,
        // Same mated frame as LidMesh: local Z=0 lands at lidGroupZ.
        lidGroupZ: lipTopZ - anchorZ,
      };
    })
  );

  const { geometry, edgesGeometry, hasPrecomputedNormals } = useMeshGeometry({
    vertices: stackPlateMesh?.vertices ?? null,
    normals: stackPlateMesh?.normals ?? null,
    indices: stackPlateMesh?.indices ?? null,
    edgeVertices: stackPlateMesh?.edgeVertices ?? null,
  });

  // The plate glues onto the lid, so it shares the lid's zone color in
  // multi-color mode (matches the exporter, which paints it lid-colored).
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors is null-coalesced upstream (legacy persisted configs); runtime guard kept as belt-and-suspenders.
  const plateColor = featureColors?.enabled ? getZoneColor(featureColors, 'lid') : color;

  const matProps = useMemo(
    () => ({
      color: plateColor,
      roughness: 0.45,
      metalness: 0,
      wireframe,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: xray ? BASE_OPACITY * XRAY_OPACITY_FACTOR : BASE_OPACITY,
      depthWrite: !xray,
      flatShading: !hasPrecomputedNormals,
    }),
    [plateColor, wireframe, hasPrecomputedNormals, xray]
  );

  useEffect(() => {
    invalidate();
  }, [geometry, lidOffsetMm, invalidate]);

  if (!geometry) return null;

  const positionZ = lidGroupZ + lidOffsetMm + SEPARATE_STACK_PLATE_PREVIEW_GAP_MM;

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
