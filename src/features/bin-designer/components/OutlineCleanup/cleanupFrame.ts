/**
 * A path cutout's outline in the frame it is drawn in, and back.
 *
 * Path points are stored unturned and drawn turned by `rotation` about the
 * middle of their bounds. Cleanup runs on the outline as drawn, so squaring
 * an edge squares it to the bin and an upright mirror line looks upright.
 */

import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import type { CleanedOutline, Pt, Region } from '@/shared/outlineCleanup';
import { flattenPath } from '@/shared/utils/pathGeometryBezier';
import { getPathBounds } from '../panel/CutoutsSection/pathGeometry';

/** Flattening step for the dense outline cleanup starts from, in mm. */
const BASELINE_STEP_MM = 0.05;

/** `p` turned by `deg` about the origin, the way a cutout is drawn: clockwise for positive. */
function turn(p: Pt, deg: number): Pt {
  const a = (-deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

function middle(path: readonly PathPoint[]): Pt {
  const b = getPathBounds(path);
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}

/** The cutout's outline and islands, densely, as drawn. Null for a cutout with no path. */
export function drawnRegion(cutout: Cutout): Region | null {
  if (!cutout.path) return null;
  const c = middle(cutout.path);
  const drawn = (ring: readonly PathPoint[]): Pt[] =>
    flattenPath(ring, BASELINE_STEP_MM).map((p) => {
      const q = turn({ x: p.x - c.x, y: p.y - c.y }, cutout.rotation);
      return { x: q.x + c.x, y: q.y + c.y };
    });
  return { outline: drawn(cutout.path), holes: (cutout.holes ?? []).map(drawn) };
}

export type OutlinePatch = Pick<Cutout, 'path' | 'holes' | 'x' | 'y' | 'width' | 'depth'>;

function boundsPatch(path: PathPoint[], holes: PathPoint[][]): OutlinePatch {
  const b = getPathBounds(path);
  return {
    path,
    holes: holes.length > 0 ? holes : undefined,
    x: b.minX,
    y: b.minY,
    width: b.maxX - b.minX,
    depth: b.maxY - b.minY,
  };
}

/**
 * The stored path that draws as `cleaned` under `rotationDeg`. Turning back
 * about the origin leaves the shape where it belongs only up to a shift,
 * because the turn's centre is the middle of the bounds it ends up with; the
 * shift that makes that centre a fixed point is `R·b − b`, `b` being the
 * middle of the unturned bounds.
 */
export function storedPatch(cleaned: CleanedOutline, rotationDeg: number): OutlinePatch {
  if (rotationDeg === 0) return boundsPatch(cleaned.path, cleaned.holes);
  const unturn = (ring: readonly PathPoint[]): PathPoint[] =>
    ring.map((p) => {
      const q = turn(p, -rotationDeg);
      const handle = (h: PathPoint['handleIn']) => {
        if (!h) return null;
        const v = turn({ x: h.dx, y: h.dy }, -rotationDeg);
        return { dx: v.x, dy: v.y };
      };
      return { ...p, x: q.x, y: q.y, handleIn: handle(p.handleIn), handleOut: handle(p.handleOut) };
    });
  const path = unturn(cleaned.path);
  const holes = cleaned.holes.map(unturn);
  const b = middle(path);
  const rb = turn(b, rotationDeg);
  const shift = { x: rb.x - b.x, y: rb.y - b.y };
  const move = (ring: PathPoint[]) =>
    ring.map((p) => ({ ...p, x: p.x + shift.x, y: p.y + shift.y }));
  return boundsPatch(move(path), holes.map(move));
}
