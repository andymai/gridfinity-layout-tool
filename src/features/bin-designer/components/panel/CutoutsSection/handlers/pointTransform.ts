/**
 * Scale or turn a few selected points of a path, through a box drawn around
 * them on the canvas: a jaw traced a little narrow, a tab traced at a slant.
 *
 * The box lives in the drawn frame, so it lines up with what the user sees on
 * a turned cutout. Points and handles go out to that frame, through the
 * transform, and back to the path's own frame. No React, no store.
 */

import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import { toDrawnFrame, toPathFrame } from './pathRings';
import type { Rect } from './pointEdits';

export type TransformHandle = 'nw' | 'ne' | 'sw' | 'se' | 'rotate';

/** The step a turn snaps to with Shift held, in degrees. */
const TURN_SNAP_DEG = 15;

/** Box sides shorter than this, in mm, are not scaled along: a line of points has no width. */
const MIN_SPAN_MM = 1e-6;

/** Where the corner a handle names sits on `box`. */
export function cornerOf(
  box: Rect,
  handle: Exclude<TransformHandle, 'rotate'>
): { x: number; y: number } {
  return {
    x: handle === 'nw' || handle === 'sw' ? box.minX : box.maxX,
    y: handle === 'sw' || handle === 'se' ? box.minY : box.maxY,
  };
}

const OPPOSITE: Record<Exclude<TransformHandle, 'rotate'>, Exclude<TransformHandle, 'rotate'>> = {
  nw: 'se',
  ne: 'sw',
  sw: 'ne',
  se: 'nw',
};

interface Affine {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly ox: number;
  readonly oy: number;
}

function scaleFor(span: number, from: number, to: number): number {
  return Math.abs(span) > MIN_SPAN_MM ? to / from : 1;
}

/**
 * The transform the pointer has made, moved from `start` to `to` with
 * `handle` held: a corner scales about the opposite corner (`uniform` keeps
 * the proportions), the rotate handle turns about the middle (`uniform`
 * snaps it to 15° steps).
 */
function affineFor(
  box: Rect,
  handle: TransformHandle,
  start: { x: number; y: number },
  to: { x: number; y: number },
  uniform: boolean
): Affine {
  if (handle === 'rotate') {
    const ox = (box.minX + box.maxX) / 2;
    const oy = (box.minY + box.maxY) / 2;
    let turn = Math.atan2(to.y - oy, to.x - ox) - Math.atan2(start.y - oy, start.x - ox);
    if (uniform) {
      const step = (TURN_SNAP_DEG * Math.PI) / 180;
      turn = Math.round(turn / step) * step;
    }
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    return { a: cos, b: -sin, c: sin, d: cos, ox, oy };
  }
  const o = cornerOf(box, OPPOSITE[handle]);
  const corner = cornerOf(box, handle);
  let sx = scaleFor(corner.x - o.x, corner.x - o.x, to.x - o.x);
  let sy = scaleFor(corner.y - o.y, corner.y - o.y, to.y - o.y);
  if (uniform) {
    const s = Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy;
    sx = s;
    sy = s;
  }
  return { a: sx, b: 0, c: 0, d: sy, ox: o.x, oy: o.y };
}

/**
 * The ring with the points at `indices` scaled or turned, as the pointer has
 * moved from `start` to `to` on the canvas with `handle` held.
 */
export function transformPoints(
  cutout: Cutout,
  points: readonly PathPoint[],
  indices: readonly number[],
  drag: {
    readonly handle: TransformHandle;
    readonly box: Rect;
    readonly startX: number;
    readonly startY: number;
  },
  to: { readonly x: number; readonly y: number },
  uniform: boolean
): PathPoint[] {
  const m = affineFor(drag.box, drag.handle, { x: drag.startX, y: drag.startY }, to, uniform);
  const map = (x: number, y: number) => {
    const dx = x - m.ox;
    const dy = y - m.oy;
    return { x: m.ox + m.a * dx + m.b * dy, y: m.oy + m.c * dx + m.d * dy };
  };
  const chosen = new Set(indices);
  return points.map((p, i) => {
    if (!chosen.has(i)) return p;
    const drawn = toDrawnFrame(cutout, p.x, p.y);
    const moved = map(drawn.x, drawn.y);
    const back = toPathFrame(cutout, moved.x, moved.y);
    // A handle is a direction from its point, so it takes the same transform as
    // the line from the point to its end, measured in the same two frames.
    const handle = (h: PathPoint['handleIn']) => {
      if (!h) return null;
      const tip = toDrawnFrame(cutout, p.x + h.dx, p.y + h.dy);
      const end = map(tip.x, tip.y);
      const stored = toPathFrame(cutout, end.x, end.y);
      return { dx: stored.x - back.x, dy: stored.y - back.y };
    };
    return {
      ...p,
      x: back.x,
      y: back.y,
      handleIn: handle(p.handleIn),
      handleOut: handle(p.handleOut),
    };
  });
}
