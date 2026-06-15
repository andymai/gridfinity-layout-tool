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

/** Headroom multiplier on top of the framing distance when capping zoom-out. */
export const MAX_DISTANCE_FACTOR = 3;

/** Floor for max orbit distance so small baseplates still feel zoomable. */
export const MAX_DISTANCE_FLOOR = 800;

/** Cubic ease-out used for all preview animations (crossfade, camera transitions). */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Calculate ideal camera distance to frame the baseplate including padding.
 *
 * Uses per-axis projection framing (not bounding sphere) so the camera
 * accounts for the viewport aspect ratio — preventing wide plates from
 * appearing as a thin letterboxed strip in landscape viewports.
 *
 * `aspect` defaults to 1 when called outside the Canvas context (e.g. for
 * orbit-distance caps where the exact aspect doesn't matter).
 */
export function calculateIdealDistance(
  width: number,
  depth: number,
  gridUnitMm: number,
  paddingLeft: number,
  paddingRight: number,
  paddingFront: number,
  paddingBack: number,
  fov: number,
  aspect = 1
): number {
  const outerW = width * gridUnitMm + paddingLeft + paddingRight;
  const outerD = depth * gridUnitMm + paddingFront + paddingBack;

  const halfFovTan = Math.tan((fov / 2) * (Math.PI / 180));
  const dForWidth = outerW / 2 / (halfFovTan * aspect * FRAME_FILL);
  const dForDepth = outerD / 2 / (halfFovTan * FRAME_FILL);
  return Math.max(dForWidth, dForDepth);
}

/**
 * Ideal camera distance for a 3D stack-print tower layout using bounding-sphere
 * framing. Appropriate for 3D geometry (unlike the top-down plate framing above).
 */
export function calculateStackIdealDistance(
  widthMm: number,
  depthMm: number,
  heightMm: number,
  fov: number
): number {
  const halfW = widthMm / 2;
  const halfD = depthMm / 2;
  const halfH = heightMm / 2;
  const boundingRadius = Math.sqrt(halfW * halfW + halfD * halfD + halfH * halfH);
  const halfFovRad = (fov / 2) * (Math.PI / 180);
  return (boundingRadius / Math.sin(halfFovRad)) * (1 / FRAME_FILL);
}

/**
 * Cap on how far the user can orbit out from the baseplate.
 *
 * Why: A static cap (we used to ship 800mm) clamped before the framing
 * distance for any baseplate larger than ~10×10 grid units, so users
 * physically could not pull back far enough to see the whole part.
 */
export function calculateMaxOrbitDistance(idealDistance: number): number {
  return Math.max(MAX_DISTANCE_FLOOR, idealDistance * MAX_DISTANCE_FACTOR);
}

/** Floor for the camera far plane so tiny baseplates still look right. */
export const FAR_PLANE_FLOOR = 2000;

/**
 * Camera far-plane distance that comfortably contains the geometry at any
 * allowed zoom-out level. The 1.5× factor is the buffer for the baseplate's
 * own bounding radius — when the camera is at `maxOrbitDistance`, the far
 * corner of the slab still sits ahead of it.
 */
export function calculateFarPlane(maxOrbitDistance: number): number {
  return Math.max(FAR_PLANE_FLOOR, maxOrbitDistance * 1.5);
}
