/**
 * Shared camera framing utilities for bin thumbnail capture.
 *
 * Used by both the live preview capture (thumbnail.ts) and the
 * offscreen regenerator (thumbnailRegenerator.ts).
 */

import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

/**
 * Standard isometric camera direction (matches PreviewCanvas.CAMERA_PRESETS.isometric),
 * as a normalized {x,y,z}. Kept three-free (a plain object, not a THREE.Vector3) so
 * this module — pulled by the eagerly-reachable thumbnail regenerator — doesn't drag
 * three core onto first paint. Construct a Vector3 from it at the (three-loaded) call site.
 */
export const ISOMETRIC_DIRECTION: Readonly<{ x: number; y: number; z: number }> = (() => {
  const x = 0.6;
  const y = -0.6;
  const z = 0.5;
  const len = Math.hypot(x, y, z);
  return { x: x / len, y: y / len, z: z / len };
})();

/** How much of the viewport the bin should fill (matches PreviewCanvas.FRAME_FILL) */
export const FRAME_FILL = 0.65;

/**
 * Calculate ideal camera distance to frame a bin at a given FOV.
 *
 * Computes the bounding sphere of the bin's outer dimensions and returns
 * the camera distance needed to fill the viewport by FRAME_FILL fraction.
 */
export function calculateIdealDistance(
  width: number,
  depth: number,
  height: number,
  fov: number,
  gridUnitMm: number = GRIDFINITY.GRID_SIZE,
  heightUnitMm: number = GRIDFINITY.HEIGHT_UNIT
): number {
  const outerW = width * gridUnitMm;
  const outerD = depth * gridUnitMm;
  const totalH = height * heightUnitMm;

  const halfW = outerW / 2;
  const halfD = outerD / 2;
  const halfH = totalH / 2;
  const boundingRadius = Math.sqrt(halfW * halfW + halfD * halfD + halfH * halfH);

  const halfFovRad = (fov / 2) * (Math.PI / 180);
  return (boundingRadius / Math.sin(halfFovRad)) * (1 / FRAME_FILL);
}
