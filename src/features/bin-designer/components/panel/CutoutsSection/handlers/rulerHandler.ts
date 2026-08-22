/**
 * Pure logic for the ruler measurement tool.
 *
 * Builds a snap model from everything on the board, finds the nearest snap
 * within a screen-space threshold, and computes the measurement.
 *
 * Three kinds of target, resolved in that order (#3696):
 *
 *   point   - a corner, an edge midpoint, a centre, a real polygon vertex
 *   segment - anywhere along an edge: the bin's interior walls, a shape's
 *             true edges
 *   grid    - the editor's own snap lattice, when snap is on
 *
 * Points beat segments beat the grid, which is what makes a corner reachable
 * when an edge runs through it. Below all three the cursor stays free, so a
 * measurement is never forced onto something.
 */

import type { Cutout } from '@/features/bin-designer/types';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import { getRotatedBounds } from '../geometry';
import { getCutoutOutline } from '../cutoutOutline';

/** What a snapped point landed on, so the overlay can say which. */
export type SnapKind = 'point' | 'edge' | 'grid' | 'none';

/** A snap target point derived from board geometry */
export interface SnapTarget {
  readonly x: number;
  readonly y: number;
}

/** A snap target line, snapped to at its nearest point. */
export interface SnapSegment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** Everything on the board the ruler can snap to. */
export interface SnapModel {
  readonly points: readonly SnapTarget[];
  readonly segments: readonly SnapSegment[];
  /** Snap lattice pitch in mm, or null when the editor's snap is off. */
  readonly gridSize: number | null;
}

/** Board context the snap model is built from. */
export interface SnapModelInput {
  readonly cutouts: readonly Cutout[];
  readonly meshAssets?: Readonly<Record<string, MeshAsset>>;
  /** Interior cavity width in mm. The editor works in the [0, innerW] frame. */
  readonly innerW: number;
  /** Interior cavity depth in mm. */
  readonly innerD: number;
  /** Editor snap pitch in mm, or null when snap is off. */
  readonly gridSize: number | null;
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
 * A ring shorter than this cannot describe an edge, so it contributes only
 * whatever vertices it has.
 */
const MIN_RING_POINTS = 2;

/** Corners, edge midpoints and centre of an axis-aligned box. */
function boxPoints(minX: number, minY: number, maxX: number, maxY: number): SnapTarget[] {
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: minX, y: maxY },
    { x: maxX, y: maxY },
    { x: cx, y: minY },
    { x: cx, y: maxY },
    { x: minX, y: cy },
    { x: maxX, y: cy },
    { x: cx, y: cy },
  ];
}

/** The four walls of an axis-aligned box, as segments. */
function boxSegments(minX: number, minY: number, maxX: number, maxY: number): SnapSegment[] {
  return [
    { x1: minX, y1: minY, x2: maxX, y2: minY },
    { x1: maxX, y1: minY, x2: maxX, y2: maxY },
    { x1: maxX, y1: maxY, x2: minX, y2: maxY },
    { x1: minX, y1: maxY, x2: minX, y2: minY },
  ];
}

/**
 * Everything on the board the ruler can snap to.
 *
 * Shape outlines come from `getCutoutOutline`, the silhouette the canvas
 * already draws, so a rotated shape and a pen path snap to their real edges.
 * The rotated bounding box is the fallback only for a shape too degenerate to
 * outline, which is the verdict the rest of the editor gives it anyway.
 */
export function buildSnapModel(input: SnapModelInput): SnapModel {
  const points: SnapTarget[] = [];
  const segments: SnapSegment[] = [];

  // The interior walls: the most common thing to measure to, and what the
  // bounding-box-only model could not offer at all.
  if (input.innerW > 0 && input.innerD > 0) {
    points.push(...boxPoints(0, 0, input.innerW, input.innerD));
    segments.push(...boxSegments(0, 0, input.innerW, input.innerD));
  }

  for (const cutout of input.cutouts) {
    if (cutout.hidden) continue;

    const rings = getCutoutOutline(cutout, input.meshAssets);
    if (!rings) {
      // Degenerate shape: keep the box verdict rather than dropping it.
      const bounds = getRotatedBounds(cutout);
      points.push(...boxPoints(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY));
      continue;
    }

    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (const ring of rings) {
      if (ring.length < MIN_RING_POINTS) {
        points.push(...ring);
        continue;
      }
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        points.push({ x: a.x, y: a.y });
        points.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        sumX += a.x;
        sumY += a.y;
        count++;
      }
    }
    // Centroid of the real outline, not of the bounding box: on a rotated or
    // path shape those are different points and only one is on the shape.
    if (count > 0) points.push({ x: sumX / count, y: sumY / count });
  }

  return { points, segments, gridSize: input.gridSize };
}

/** Nearest point on a segment to (x, y), clamped to the segment's ends. */
export function nearestPointOnSegment(
  x: number,
  y: number,
  seg: SnapSegment
): { readonly x: number; readonly y: number } {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: seg.x1, y: seg.y1 };
  const t = Math.min(1, Math.max(0, ((x - seg.x1) * dx + (y - seg.y1) * dy) / lenSq));
  return { x: seg.x1 + t * dx, y: seg.y1 + t * dy };
}

export interface SnapResult {
  readonly x: number;
  readonly y: number;
  readonly snapped: boolean;
  readonly kind: SnapKind;
}

/**
 * Find the nearest snap within the threshold, or the original point.
 *
 * Resolved by KIND first and distance second: a point inside the threshold
 * always wins over a nearer spot on an edge. Without that, an edge running
 * through a corner would swallow the corner, since every point on the edge is
 * zero distance from the edge.
 *
 * @param mmX - cursor position in mm
 * @param mmY - cursor position in mm
 * @param model - pre-built snap model
 * @param zoom - current camera zoom (pixels per mm)
 */
export function snapToNearestTarget(
  mmX: number,
  mmY: number,
  resolved: SnapModel,
  zoom: number
): SnapResult {
  const thresholdMm = SNAP_THRESHOLD_PX / zoom;
  const thresholdSq = thresholdMm * thresholdMm;

  let bestPoint: SnapTarget | null = null;
  let bestPointSq = thresholdSq;
  for (const target of resolved.points) {
    const dx = mmX - target.x;
    const dy = mmY - target.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestPointSq) {
      bestPointSq = distSq;
      bestPoint = target;
    }
  }
  if (bestPoint) return { x: bestPoint.x, y: bestPoint.y, snapped: true, kind: 'point' };

  let bestEdge: { x: number; y: number } | null = null;
  let bestEdgeSq = thresholdSq;
  for (const seg of resolved.segments) {
    const p = nearestPointOnSegment(mmX, mmY, seg);
    const dx = mmX - p.x;
    const dy = mmY - p.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestEdgeSq) {
      bestEdgeSq = distSq;
      bestEdge = p;
    }
  }
  if (bestEdge) return { x: bestEdge.x, y: bestEdge.y, snapped: true, kind: 'edge' };

  const { gridSize } = resolved;
  if (gridSize !== null && gridSize > 0) {
    const gx = Math.round(mmX / gridSize) * gridSize;
    const gy = Math.round(mmY / gridSize) * gridSize;
    const dx = mmX - gx;
    const dy = mmY - gy;
    if (dx * dx + dy * dy < thresholdSq) {
      return { x: gx, y: gy, snapped: true, kind: 'grid' };
    }
  }

  return { x: mmX, y: mmY, snapped: false, kind: 'none' };
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
