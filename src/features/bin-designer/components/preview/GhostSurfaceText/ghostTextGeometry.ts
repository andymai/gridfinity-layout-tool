/**
 * Pure geometry for the wall-text ghost overlay.
 *
 * Split out of the component so the module exports only a component (fast
 * refresh) and so the closing-edge rule has a test of its own: a glyph contour
 * with a missing edge is easy to miss on screen and invisible in the plan.
 */

import type { OutlineCommand } from '@/shared/utils/typePlan';

/** Segments per curve. A ghost needs the shape, not the tolerance. */
const CURVE_STEPS = 6;

/** Flatten one glyph's outline into closed polylines in the reading frame. */
export function outlineToContours(
  commands: readonly OutlineCommand[],
  scale: number,
  originX: number,
  originY: number
): number[][] {
  const contours: number[][] = [];
  let current: number[] = [];
  let cx = 0;
  let cy = 0;
  const push = (x: number, y: number): void => {
    current.push(originX + x * scale, originY + y * scale);
    cx = x;
    cy = y;
  };
  const quad = (x1: number, y1: number, x: number, y: number): void => {
    const sx = cx;
    const sy = cy;
    for (let i = 1; i <= CURVE_STEPS; i++) {
      const t = i / CURVE_STEPS;
      const u = 1 - t;
      push(u * u * sx + 2 * u * t * x1 + t * t * x, u * u * sy + 2 * u * t * y1 + t * t * y);
    }
  };
  const cubic = (x1: number, y1: number, x2: number, y2: number, x: number, y: number): void => {
    const sx = cx;
    const sy = cy;
    for (let i = 1; i <= CURVE_STEPS; i++) {
      const t = i / CURVE_STEPS;
      const u = 1 - t;
      push(
        u * u * u * sx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
        u * u * u * sy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y
      );
    }
  };

  for (const cmd of commands) {
    if (cmd.type === 'M' && cmd.x !== undefined && cmd.y !== undefined) {
      if (current.length >= 4) contours.push(current);
      current = [];
      push(cmd.x, cmd.y);
    } else if (cmd.type === 'L' && cmd.x !== undefined && cmd.y !== undefined) {
      push(cmd.x, cmd.y);
    } else if (
      cmd.type === 'Q' &&
      cmd.x !== undefined &&
      cmd.y !== undefined &&
      cmd.x1 !== undefined &&
      cmd.y1 !== undefined
    ) {
      quad(cmd.x1, cmd.y1, cmd.x, cmd.y);
    } else if (
      cmd.type === 'C' &&
      cmd.x !== undefined &&
      cmd.y !== undefined &&
      cmd.x1 !== undefined &&
      cmd.y1 !== undefined &&
      cmd.x2 !== undefined &&
      cmd.y2 !== undefined
    ) {
      cubic(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
    } else if (cmd.type === 'Z') {
      if (current.length >= 4) contours.push(current);
      current = [];
    }
  }
  if (current.length >= 4) contours.push(current);
  return contours;
}

/**
 * A closed contour as line-segment endpoint pairs.
 *
 * The closing run back to the start is the point: a glyph contour ends with a
 * `Z` that carries no coordinates, so walking the points alone leaves every
 * letter one edge short and the preview shows outlines with a gap in them.
 * Exported for its own test, because that gap is easy to miss on screen and
 * impossible to see in a plan.
 */
export function contourSegments(contour: readonly number[]): number[] {
  const out: number[] = [];
  if (contour.length < 4) return out;
  for (let i = 0; i + 3 < contour.length; i += 2) {
    out.push(contour[i], contour[i + 1], contour[i + 2], contour[i + 3]);
  }
  const lastX = contour[contour.length - 2];
  const lastY = contour[contour.length - 1];
  if (lastX !== contour[0] || lastY !== contour[1]) {
    out.push(lastX, lastY, contour[0], contour[1]);
  }
  return out;
}
