/**
 * Orchestrates the trace pipeline: RGBA image → closed SVG outline.
 *
 * mask → largest component → outer contour → simplify → SVG path. The SVG is
 * emitted in pixel (user) units with only a viewBox; real-world millimeters are
 * established later by the scale-confirm step, not here.
 */

import type { Result } from '@/core/result';
import { ok, err, isErr } from '@/core/result';
import type { ImageDataLike, Point, TraceError, TraceOptions, TraceResult } from './types';
import { buildMask } from './mask';
import { largestComponent } from './components';
import { traceContour } from './contour';
import { simplifyRdp } from './simplify';

function defaultMinArea(width: number, height: number): number {
  return Math.max(16, Math.round(width * height * 0.0008));
}

function defaultTolerance(width: number, height: number): number {
  const diag = Math.sqrt(width * width + height * height);
  return Math.max(1, diag * 0.004);
}

/** Shoelace area of a polygon (absolute value, in px²). */
export function polygonArea(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Geometry-only pipeline: image → simplified outer-contour points. */
export function traceToPoints(
  img: ImageDataLike,
  options: TraceOptions = {}
): Result<Point[], TraceError> {
  const { width, height } = img;
  if (width <= 0 || height <= 0) {
    return err({ code: 'NO_OBJECT', detail: 'Empty image' });
  }

  const mask = buildMask(img, options);
  const component = largestComponent(mask);
  const minArea = options.minAreaPx ?? defaultMinArea(width, height);
  if (component.start === null || component.area < minArea) {
    return err({ code: 'NO_OBJECT', detail: `Largest region ${component.area}px < ${minArea}px` });
  }

  const contour = traceContour(component.mask, component.start);
  const tolerance = options.simplifyTolerance ?? defaultTolerance(width, height);
  const simplified = simplifyRdp(contour, tolerance);

  if (simplified.length < 3 || polygonArea(simplified) < 1) {
    return err({ code: 'DEGENERATE', detail: 'Outline collapsed to a line' });
  }

  return ok(simplified);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function pointsToSvgPath(points: readonly Point[]): string {
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${round2(p.x)} ${round2(p.y)}`).join(' ');
  return `${d} Z`;
}

/** Full pipeline: image → standalone SVG string (one closed path). */
export function traceImage(img: ImageDataLike, options: TraceOptions = {}): TraceResult {
  const result = traceToPoints(img, options);
  if (isErr(result)) return result;

  const path = pointsToSvgPath(result.value);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${img.width} ${img.height}">` +
    `<path d="${path}"/></svg>`;
  return ok(svg);
}
