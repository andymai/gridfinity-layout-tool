/**
 * Edits to several points of one ring at once: the selection a marquee or a
 * Shift-click makes, and the moves, deletions and point kinds applied to it.
 *
 * A selection lives on one ring at a time, because every edit is checked ring
 * by ring: an island's place inside the outline is what `keepsShape` guards.
 * Rings are in the path's own frame. No React, no store.
 */

import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import { MIN_PATH_POINTS } from '@/features/bin-designer/types';
import { ringsOf, toDrawnFrame } from './pathRings';

export interface Rect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export function normalizeSelection(indices: Iterable<number>, length: number): number[] {
  return [...new Set(indices)]
    .filter((i) => Number.isInteger(i) && i >= 0 && i < length)
    .sort((a, b) => a - b);
}

export function toggleIndex(selection: readonly number[], index: number): number[] {
  return selection.includes(index)
    ? selection.filter((i) => i !== index)
    : [...selection, index].sort((a, b) => a - b);
}

/**
 * The points a marquee drawn on the canvas holds, on one ring: the ring with
 * the most points inside it, the outline on a tie. Null when it holds none.
 */
export function pointsInRect(
  cutout: Cutout,
  rect: Rect
): { ring: number; indices: number[] } | null {
  let best: { ring: number; indices: number[] } | null = null;
  ringsOf(cutout).forEach((points, ring) => {
    const indices: number[] = [];
    points.forEach((p, i) => {
      const at = toDrawnFrame(cutout, p.x, p.y);
      if (at.x >= rect.minX && at.x <= rect.maxX && at.y >= rect.minY && at.y <= rect.maxY) {
        indices.push(i);
      }
    });
    if (indices.length > (best?.indices.length ?? 0)) best = { ring, indices };
  });
  return best;
}

/** Handles are relative to their point, so they ride along. */
export function movePoints(
  points: readonly PathPoint[],
  indices: readonly number[],
  dx: number,
  dy: number
): PathPoint[] {
  const moved = new Set(indices);
  return points.map((p, i) => (moved.has(i) ? { ...p, x: p.x + dx, y: p.y + dy } : p));
}

export function removePoints(
  points: readonly PathPoint[],
  indices: readonly number[]
): PathPoint[] | null {
  const gone = new Set(indices);
  const kept = points.filter((_, i) => !gone.has(i));
  return kept.length >= MIN_PATH_POINTS && kept.length < points.length ? kept : null;
}

export type PointKind = 'smooth' | 'corner';

export function allSmooth(points: readonly PathPoint[], indices: readonly number[]): boolean {
  return indices.every((i) => {
    const p = points.at(i);
    return p !== undefined && p.handleIn !== null && p.handleOut !== null;
  });
}

/**
 * The points at `indices` made smooth or sharp. A smooth point gets handles on
 * the line through its neighbours, a third of the way to each, the curve a
 * hand drawing through the three takes. A corner loses its handles.
 */
export function setPointKind(
  points: readonly PathPoint[],
  indices: readonly number[],
  kind: PointKind
): PathPoint[] {
  const chosen = new Set(indices);
  const n = points.length;
  return points.map((p, i) => {
    if (!chosen.has(i)) return p;
    if (kind === 'corner') return { ...p, handleIn: null, handleOut: null, symmetric: false };
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const length = Math.hypot(tx, ty);
    if (length === 0) return p;
    const ux = tx / length;
    const uy = ty / length;
    const back = Math.hypot(p.x - prev.x, p.y - prev.y) / 3;
    const ahead = Math.hypot(next.x - p.x, next.y - p.y) / 3;
    return {
      ...p,
      handleIn: { dx: -ux * back, dy: -uy * back },
      handleOut: { dx: ux * ahead, dy: uy * ahead },
      symmetric: false,
    };
  });
}

/** In the drawn frame, so it lines up with what the user sees on a turned path. */
export function drawnBox(cutout: Cutout, ring: number, indices: readonly number[]): Rect | null {
  const points = ringsOf(cutout).at(ring);
  if (!points) return null;
  let box: Rect | null = null;
  for (const i of indices) {
    const p = points.at(i);
    if (!p) continue;
    const at = toDrawnFrame(cutout, p.x, p.y);
    box = box
      ? {
          minX: Math.min(box.minX, at.x),
          minY: Math.min(box.minY, at.y),
          maxX: Math.max(box.maxX, at.x),
          maxY: Math.max(box.maxY, at.y),
        }
      : { minX: at.x, minY: at.y, maxX: at.x, maxY: at.y };
  }
  return box;
}
