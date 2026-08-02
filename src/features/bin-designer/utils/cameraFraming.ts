/**
 * Shared camera framing utilities for bin thumbnail capture.
 *
 * Used by both the live preview capture (thumbnail.ts) and the
 * offscreen regenerator (thumbnailRegenerator.ts).
 */

import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

/**
 * Normalized camera direction as a plain {x,y,z}. Kept three-free (not a
 * THREE.Vector3) so this module, pulled by the eagerly-reachable thumbnail
 * regenerator, doesn't drag three core onto first paint. Construct a Vector3
 * from it at the (three-loaded) call site.
 */
export type CameraDirection = Readonly<{ x: number; y: number; z: number }>;

function normalizeDirection(x: number, y: number, z: number): CameraDirection {
  const len = Math.hypot(x, y, z);
  return { x: x / len, y: y / len, z: z / len };
}

/** Standard isometric camera direction (matches PreviewCanvas.CAMERA_PRESETS.isometric). */
export const ISOMETRIC_DIRECTION: CameraDirection = normalizeDirection(0.6, -0.6, 0.5);

/** Matches PreviewCanvas.CAMERA_PRESETS.front. */
export const FRONT_DIRECTION: CameraDirection = normalizeDirection(0, -1, 0.3);

/** Matches PreviewCanvas.CAMERA_PRESETS.side. */
export const SIDE_DIRECTION: CameraDirection = normalizeDirection(1, 0, 0.3);

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
  heightUnitMm: number = GRIDFINITY.HEIGHT_UNIT,
  // Y-axis pitch for non-square grids; defaults to the X pitch (square).
  gridUnitMmY: number = gridUnitMm
): number {
  const outerW = width * gridUnitMm;
  const outerD = depth * gridUnitMmY;
  const totalH = height * heightUnitMm;

  const halfW = outerW / 2;
  const halfD = outerD / 2;
  const halfH = totalH / 2;
  const boundingRadius = Math.sqrt(halfW * halfW + halfD * halfD + halfH * halfH);

  const halfFovRad = (fov / 2) * (Math.PI / 180);
  return (boundingRadius / Math.sin(halfFovRad)) * (1 / FRAME_FILL);
}
