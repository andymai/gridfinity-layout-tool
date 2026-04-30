/**
 * Pure logic for the ruler measurement tool.
 *
 * Computes snap targets from cutout edges/corners/centers,
 * finds the nearest snap point within a threshold, and
 * calculates measurement results (distance, deltas).
 */

import type { Cutout } from '@/features/bin-designer/types';
import { getRotatedBounds } from '../geometry';

/** A snap target point derived from cutout geometry */
export interface SnapTarget {
  readonly x: number;
  readonly y: number;
}

/** Result of a ruler measurement between two points */
export interface RulerMeasurement {
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  /** Straight-line distance in mm */
  readonly distance: number;
  /** Horizontal delta */
  readonly deltaX: number;
  /** Vertical delta */
  readonly deltaY: number;
}

/** Snap threshold in screen pixels */
const SNAP_THRESHOLD_PX = 8;

/**
 * Collect all snap targets from cutout bounding boxes.
 * Uses axis-aligned bounding boxes (AABB) that account for rotation,
 * so for rotated cutouts the snap points are on the AABB rather than
 * the actual rotated edges.
 */
export function collectSnapTargets(cutouts: readonly Cutout[]): readonly SnapTarget[] {
  const targets: SnapTarget[] = [];

  for (const cutout of cutouts) {
    if (cutout.hidden) continue;

    const bounds = getRotatedBounds(cutout);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;

    // Corners
    targets.push({ x: bounds.minX, y: bounds.minY });
    targets.push({ x: bounds.maxX, y: bounds.minY });
    targets.push({ x: bounds.minX, y: bounds.maxY });
    targets.push({ x: bounds.maxX, y: bounds.maxY });

    // Edge midpoints
    targets.push({ x: cx, y: bounds.minY });
    targets.push({ x: cx, y: bounds.maxY });
    targets.push({ x: bounds.minX, y: cy });
    targets.push({ x: bounds.maxX, y: cy });

    // Center
    targets.push({ x: cx, y: cy });
  }

  return targets;
}

/**
 * Find the nearest snap target within the threshold.
 * Returns the snapped point, or the original point if nothing is close enough.
 *
 * @param mmX - cursor position in mm
 * @param mmY - cursor position in mm
 * @param targets - pre-collected snap targets
 * @param zoom - current camera zoom (pixels per mm)
 */
export function snapToNearestTarget(
  mmX: number,
  mmY: number,
  targets: readonly SnapTarget[],
  zoom: number
): { x: number; y: number; snapped: boolean } {
  const thresholdMm = SNAP_THRESHOLD_PX / zoom;
  const thresholdSq = thresholdMm * thresholdMm;
  let bestDistSq = thresholdSq;
  let bestTarget: SnapTarget | null = null;

  for (const target of targets) {
    const dx = mmX - target.x;
    const dy = mmY - target.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestTarget = target;
    }
  }

  if (bestTarget) {
    return { x: bestTarget.x, y: bestTarget.y, snapped: true };
  }
  return { x: mmX, y: mmY, snapped: false };
}

/** Compute the measurement result between two points */
export function computeMeasurement(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): RulerMeasurement {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  return { startX, startY, endX, endY, distance, deltaX, deltaY };
}
