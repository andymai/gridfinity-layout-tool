/**
 * Draws the top-down handle silhouette for every open-ended knife slot on the
 * editor canvas, so a knife slot reads as a knife with its handle lying past
 * the wall rather than as a plain rounded trench. See knifeSlotOverlayGeometry.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import type { Cutout } from '@/features/bin-designer/types';
import { RENDER_ORDER } from './constants';
import { knifeSlotOverlayLoops, loopToSegmentPositions } from './knifeSlotOverlayGeometry';

/** Steel, so the handle reads as the knife's, not as another cut. */
const OVERLAY_COLOR = '#94a3b8';
const OVERLAY_OPACITY = 0.7;
/** Just under the pointer-catching shapes, just over the fills. */
const OVERLAY_Z = 0.045;

interface KnifeSlotOverlayProps {
  readonly cutouts: readonly Cutout[];
}

export function KnifeSlotOverlay({ cutouts }: KnifeSlotOverlayProps) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    for (const cutout of cutouts) {
      for (const loop of knifeSlotOverlayLoops(cutout)) {
        positions.push(...loopToSegmentPositions(loop, OVERLAY_Z));
      }
    }
    if (positions.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [cutouts]);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(OVERLAY_COLOR),
        transparent: true,
        opacity: OVERLAY_OPACITY,
        depthTest: false,
      }),
    []
  );

  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const segments = useMemo(() => {
    if (!geometry) return null;
    const obj = new THREE.LineSegments(geometry, material);
    // Just under the drawing preview, above the shape fills.
    obj.renderOrder = RENDER_ORDER.DRAWING_PREVIEW - 1;
    return obj;
  }, [geometry, material]);
  if (!segments) return null;
  return <primitive object={segments} raycast={() => {}} />;
}
