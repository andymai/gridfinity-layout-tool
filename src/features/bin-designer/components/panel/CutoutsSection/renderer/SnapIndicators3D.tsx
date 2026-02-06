/**
 * WebGL snap indicators — visual feedback for grid snap points.
 *
 * Shows small crosshairs at the active snap position during drag/draw/resize.
 * Only visible when actively interacting with shapes and snap is enabled.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { RENDER_ORDER } from './constants';

interface SnapIndicators3DProps {
  /** Current cursor position in mm world coords */
  readonly cursorX: number;
  readonly cursorY: number;
  /** Snapped position in mm world coords */
  readonly snapX: number;
  readonly snapY: number;
  /** Whether to show indicators (only during active interactions) */
  readonly visible: boolean;
  /** Camera zoom for screen-space scaling */
  readonly zoom: number;
}

const SNAP_COLOR = new THREE.Color('#22c55e');
const CROSSHAIR_SIZE_PX = 4;

export function SnapIndicators3D({ snapX, snapY, visible, zoom }: SnapIndicators3DProps) {
  const geometry = useMemo(() => {
    if (!visible) return null;

    // Scale crosshair inversely with zoom to maintain constant screen size
    const mmSize = CROSSHAIR_SIZE_PX / zoom;

    const positions: number[] = [
      // Horizontal line
      snapX - mmSize,
      snapY,
      0.04,
      snapX + mmSize,
      snapY,
      0.04,
      // Vertical line
      snapX,
      snapY - mmSize,
      0.04,
      snapX,
      snapY + mmSize,
      0.04,
    ];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [snapX, snapY, visible, zoom]);

  if (!geometry) return null;

  return (
    <lineSegments geometry={geometry} renderOrder={RENDER_ORDER.SMART_GUIDES}>
      <lineBasicMaterial color={SNAP_COLOR} transparent opacity={0.8} depthTest={false} />
    </lineSegments>
  );
}
