/**
 * Horizontal and vertical flip helpers for individual cutouts and
 * cutout selections.
 *
 * Path-shape cutouts mirror each anchor's coordinate around the
 * appropriate axis center and translate the resulting path so the new
 * AABB matches the group-mirrored position. Rectangle/ellipse cutouts
 * just adjust their rotation.
 */

import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import { getPathBounds } from './pathGeometry';
import { computeBounds } from './geometryCore';

/**
 * Mirror a path point's X coordinate around a center, negating X handle components.
 * Handles are NOT swapped because the point array order is preserved.
 */
function mirrorPathPointX(pt: PathPoint, centerX: number): PathPoint {
  return {
    x: 2 * centerX - pt.x,
    y: pt.y,
    handleIn: pt.handleIn ? { dx: -pt.handleIn.dx, dy: pt.handleIn.dy } : null,
    handleOut: pt.handleOut ? { dx: -pt.handleOut.dx, dy: pt.handleOut.dy } : null,
    symmetric: pt.symmetric,
  };
}

/**
 * Mirror a path point's Y coordinate around a center, negating Y handle components.
 * Handles are NOT swapped because the point array order is preserved.
 */
function mirrorPathPointY(pt: PathPoint, centerY: number): PathPoint {
  return {
    x: pt.x,
    y: 2 * centerY - pt.y,
    handleIn: pt.handleIn ? { dx: pt.handleIn.dx, dy: -pt.handleIn.dy } : null,
    handleOut: pt.handleOut ? { dx: pt.handleOut.dx, dy: -pt.handleOut.dy } : null,
    symmetric: pt.symmetric,
  };
}

/**
 * Flip a cutout horizontally (mirror left↔right).
 *
 * - Rectangle/Circle: `rotation = (360 - rotation) % 360`
 * - Path: Mirror each point's X around bezier-accurate bounding box center,
 *   then recompute `x, y, width, depth` from the new path bounds.
 */
export function flipCutoutHorizontal(cutout: Cutout): Partial<Cutout> {
  if (cutout.shape === 'path' && cutout.path) {
    const bounds = getPathBounds(cutout.path);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const flippedPath = cutout.path.map((pt) => mirrorPathPointX(pt, cx));
    const newBounds = getPathBounds(flippedPath);
    return {
      path: flippedPath,
      x: newBounds.minX,
      y: newBounds.minY,
      width: newBounds.maxX - newBounds.minX,
      depth: newBounds.maxY - newBounds.minY,
    };
  }
  return { rotation: (360 - cutout.rotation) % 360 };
}

/**
 * Flip a cutout vertically (mirror top↔bottom).
 *
 * - Rectangle/Circle: `rotation = (180 - rotation + 360) % 360`
 * - Path: Mirror each point's Y around bezier-accurate bounding box center,
 *   then recompute `x, y, width, depth` from the new path bounds.
 */
export function flipCutoutVertical(cutout: Cutout): Partial<Cutout> {
  if (cutout.shape === 'path' && cutout.path) {
    const bounds = getPathBounds(cutout.path);
    const cy = (bounds.minY + bounds.maxY) / 2;
    const flippedPath = cutout.path.map((pt) => mirrorPathPointY(pt, cy));
    const newBounds = getPathBounds(flippedPath);
    return {
      path: flippedPath,
      x: newBounds.minX,
      y: newBounds.minY,
      width: newBounds.maxX - newBounds.minX,
      depth: newBounds.maxY - newBounds.minY,
    };
  }
  return { rotation: (180 - cutout.rotation + 360) % 360 };
}

/**
 * Compute flip-horizontal updates for a selection of cutouts.
 *
 * For multi-selection, mirrors each cutout's X position around the group center.
 * For single selection, only flips the shape geometry (rotation or path).
 */
export function flipSelectionHorizontal(
  cutouts: readonly Cutout[]
): ReadonlyMap<string, Partial<Cutout>> {
  const updates = new Map<string, Partial<Cutout>>();
  if (cutouts.length > 1) {
    const bounds = computeBounds(cutouts);
    const cx = (bounds.minX + bounds.maxX) / 2;
    for (const cutout of cutouts) {
      const patch = flipCutoutHorizontal(cutout);
      const mirroredX = 2 * cx - (cutout.x + cutout.width);
      if (cutout.shape === 'path' && patch.path) {
        // Path points are absolute — translate them to match the group-mirrored position
        const dx = mirroredX - (patch.x ?? cutout.x);
        updates.set(cutout.id, {
          ...patch,
          x: mirroredX,
          path: patch.path.map((pt) => ({ ...pt, x: pt.x + dx })),
        });
      } else {
        updates.set(cutout.id, { ...patch, x: mirroredX });
      }
    }
  } else {
    for (const cutout of cutouts) {
      updates.set(cutout.id, flipCutoutHorizontal(cutout));
    }
  }
  return updates;
}

/**
 * Compute flip-vertical updates for a selection of cutouts.
 *
 * For multi-selection, mirrors each cutout's Y position around the group center.
 * For single selection, only flips the shape geometry (rotation or path).
 */
export function flipSelectionVertical(
  cutouts: readonly Cutout[]
): ReadonlyMap<string, Partial<Cutout>> {
  const updates = new Map<string, Partial<Cutout>>();
  if (cutouts.length > 1) {
    const bounds = computeBounds(cutouts);
    const cy = (bounds.minY + bounds.maxY) / 2;
    for (const cutout of cutouts) {
      const patch = flipCutoutVertical(cutout);
      const mirroredY = 2 * cy - (cutout.y + cutout.depth);
      if (cutout.shape === 'path' && patch.path) {
        // Path points are absolute — translate them to match the group-mirrored position
        const dy = mirroredY - (patch.y ?? cutout.y);
        updates.set(cutout.id, {
          ...patch,
          y: mirroredY,
          path: patch.path.map((pt) => ({ ...pt, y: pt.y + dy })),
        });
      } else {
        updates.set(cutout.id, { ...patch, y: mirroredY });
      }
    }
  } else {
    for (const cutout of cutouts) {
      updates.set(cutout.id, flipCutoutVertical(cutout));
    }
  }
  return updates;
}
