import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';

export type CameraPreset = 'front' | 'side' | 'top' | 'isometric';

/** Camera positions for each preset (eye position looking toward center) */
export const CAMERA_PRESETS: Record<CameraPreset, [number, number, number]> = {
  front: [0, -1, 0.3],
  side: [1, 0, 0.3],
  top: [0, -0.01, 1],
  isometric: [0.6, -0.6, 0.5],
};

/** Animation duration for camera preset transitions (ms) */
export const TRANSITION_DURATION = 500;

/** Margin factor: how much of the viewport the baseplate should fill */
export const FRAME_FILL = 0.65;

/** Cubic ease-out used for all preview animations (crossfade, camera transitions). */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Calculate ideal camera distance to frame the baseplate including padding.
 */
export function calculateIdealDistance(
  width: number,
  depth: number,
  gridUnitMm: number,
  paddingLeft: number,
  paddingRight: number,
  paddingFront: number,
  paddingBack: number,
  fov: number
): number {
  const outerW = width * gridUnitMm + paddingLeft + paddingRight;
  const outerD = depth * gridUnitMm + paddingFront + paddingBack;
  const totalH = GRIDFINITY_SPEC.SOCKET_HEIGHT;

  const halfW = outerW / 2;
  const halfD = outerD / 2;
  const halfH = totalH / 2;
  const boundingRadius = Math.sqrt(halfW * halfW + halfD * halfD + halfH * halfH);

  const halfFovRad = (fov / 2) * (Math.PI / 180);
  return (boundingRadius / Math.sin(halfFovRad)) * (1 / FRAME_FILL);
}
