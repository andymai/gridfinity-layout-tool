/**
 * Dashed vertical guide line connecting the bin's lip top to the lid's
 * mating-cavity opening in exploded views. Visible only when the lid is
 * lifted more than `MIN_VISIBLE_OFFSET_MM` so it doesn't add visual noise
 * in the snapped state.
 *
 * The guide makes the docking direction obvious: a viewer sees the lid is
 * "above" the bin and visualizes how it slides down into place.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useDesignerStore } from '@/features/bin-designer/store';
import { binLipTopWorldZ } from '../LidMesh/lidAnchorZ';

/** Below this lid offset, the guide line is hidden (avoids noise in snapped view). */
const MIN_VISIBLE_OFFSET_MM = 2;

interface LidGuideLineProps {
  /** Current lid offset in mm. The guide hides when this is small. */
  lidOffsetMm: number;
  /** Accent color for the guide line (hex). */
  color?: string;
}

export function LidGuideLine({ lidOffsetMm, color = '#9ca3af' }: LidGuideLineProps) {
  const { invalidate } = useThree();
  const lineRef = useRef<THREE.LineSegments>(null);

  // Bin lip top in world Z. The lid's mating-cavity opening sits at
  // (lipTopZ + lidOffsetMm) when the lid is lifted by lidOffsetMm.
  const lipTopZ = useDesignerStore((s) =>
    binLipTopWorldZ(s.params.height, s.params.heightUnitMm, s.params.base.stackingLip)
  );
  const lidBottomWorldZ = lipTopZ + lidOffsetMm;

  // Build the dashed line geometry: a single segment from bin lip top to
  // lid mating-cavity opening, both at the lid center (X=0, Y=0).
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array([0, 0, lipTopZ, 0, 0, lidBottomWorldZ]);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geom;
  }, [lipTopZ, lidBottomWorldZ]);

  // Recompute line distances when the geometry changes — required for
  // LineDashedMaterial to render the dash pattern at correct intervals.
  useEffect(() => {
    if (lineRef.current) {
      lineRef.current.computeLineDistances();
      invalidate();
    }
  }, [geometry, invalidate]);

  // Dispose the previous GPU buffer when the geometry is replaced or the
  // component unmounts. Three.js geometries own native resources that the
  // GC won't free; matches the pattern in `useMeshGeometry`.
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Hide when the lid is approximately snapped — avoids visual noise.
  if (lidOffsetMm < MIN_VISIBLE_OFFSET_MM) return null;

  return (
    <lineSegments ref={lineRef} geometry={geometry} renderOrder={2}>
      <lineDashedMaterial
        color={color}
        dashSize={1.5}
        gapSize={1.0}
        transparent
        opacity={0.6}
        depthTest={false}
      />
    </lineSegments>
  );
}
