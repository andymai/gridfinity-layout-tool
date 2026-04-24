/**
 * Shared camera framing utilities for bin thumbnail capture.
 *
 * Used by both the live preview capture (thumbnail.ts) and the
 * offscreen regenerator (thumbnailRegenerator.ts).
 */

import { Vector3 } from 'three';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

/** Standard isometric direction (matches PreviewCanvas.CAMERA_PRESETS.isometric) */
export const ISOMETRIC_DIRECTION = new Vector3(0.6, -0.6, 0.5).normalize();

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
