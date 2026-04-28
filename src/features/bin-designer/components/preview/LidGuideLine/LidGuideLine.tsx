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
import { useShallow } from 'zustand/react/shallow';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { LID_FIT_CLEARANCE } from '@/features/bin-designer/types';

const PREVIEW_Z_OFFSET = 0.1;
const LID_EXTRA_HEIGHT = 0.2;
/** Below this lid offset, the guide line is hidden (avoids noise in snapped view). */
const MIN_VISIBLE_OFFSET_MM = 2;

function lidAnchorZ(heightUnitMm: number, fitClearance: number): number {
  return -heightUnitMm - LID_EXTRA_HEIGHT + GRIDFINITY.LIP_HEIGHT + Math.SQRT2 * fitClearance * 2;
}

interface LidGuideLineProps {
  /** Current lid offset in mm. The guide hides when this is small. */
  lidOffsetMm: number;
  /** Accent color for the guide line (hex). */
  color?: string;
}

export function LidGuideLine({ lidOffsetMm, color = '#9ca3af' }: LidGuideLineProps) {
  const { invalidate } = useThree();
  const lineRef = useRef<THREE.LineSegments>(null);

  const { binLipTopWorldZ, lidBottomWorldZ } = useDesignerStore(
    useShallow((s) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive fallback for legacy params
      const heightUnit = s.params.heightUnitMm ?? 7;
      const fitClearance = LID_FIT_CLEARANCE[s.params.lid.fit];
      const binTop = s.params.height * heightUnit + PREVIEW_Z_OFFSET;
      const anchorZ = lidAnchorZ(heightUnit, fitClearance);
      // Lid's mating-cavity opening (Y=anchor in lid local) sits at world
      // Z = binTop + lidOffsetMm when the lid is lifted by lidOffsetMm.
      const lidBottom = binTop + lidOffsetMm;
      // Use anchorZ implicitly — it's where lid Y=anchor lives, and that
      // line is what we draw the guide TO. Suppress the unused-var warning.
      void anchorZ;
      return { binLipTopWorldZ: binTop, lidBottomWorldZ: lidBottom };
    })
  );

  // Build the dashed line geometry: a single segment from bin lip top to
  // lid mating-cavity opening, both at the lid center (X=0, Y=0).
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array([0, 0, binLipTopWorldZ, 0, 0, lidBottomWorldZ]);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geom;
  }, [binLipTopWorldZ, lidBottomWorldZ]);

  // Recompute line distances each time the geometry changes — required for
  // LineDashedMaterial to render the dash pattern at correct intervals.
  useEffect(() => {
    if (lineRef.current) {
      lineRef.current.computeLineDistances();
      invalidate();
    }
  }, [geometry, invalidate]);

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
