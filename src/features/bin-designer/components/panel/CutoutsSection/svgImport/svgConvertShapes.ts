/**
 * SVG → ParsedCutoutSpec converters for primitive shapes (rect, circle,
 * ellipse, polygon/polyline) plus the small helpers shared with path
 * conversion (`pointsToPathSpec`, `pathPointsToSpec`, `makeCornerPoint`,
 * `numAttr`, `flipY`).
 *
 * Primitive shapes use a fast path when the matrix is identity-or-translate
 * (preserves shape semantics). For complex transforms (rotate, scale, skew),
 * the shape is rasterized to a path and routed through `pointsToPathSpec` /
 * `convertCircleAsPath`.
 */

import type { PathPoint } from '@/features/bin-designer/types';
import type { ParsedCutoutSpec } from './types';
import type { Matrix } from './svgTransform';
import type { ViewBox } from './types';
import { applyMatrix, isIdentityOrTranslate, transformPoint } from './svgTransform';
import { getPathBounds } from '../pathGeometry';

export function wrapSingle(spec: ParsedCutoutSpec | null): ParsedCutoutSpec[] | null {
  return spec ? [spec] : null;
}

export function numAttr(el: Element, name: string, fallback = 0): number {
  // Use isFinite over `|| fallback` so that an explicit `0` attribute
  // (legal SVG, e.g. <rect x="0">) is preserved instead of falling back.
  const parsed = parseFloat(el.getAttribute(name) ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Flip Y from SVG coordinate space (Y-down) to cutout space (Y-up from viewBox bottom). */
export function flipY(y: number, viewBox: ViewBox): number {
  return viewBox.height - y;
}

export function makeCornerPoint(x: number, y: number, matrix: Matrix, viewBox: ViewBox): PathPoint {
  const t = transformPoint(x, y, matrix, viewBox);
  return { x: t.x, y: t.y, handleIn: null, handleOut: null, symmetric: false };
}

function parsePointsAttr(pointsStr: string): Array<{ x: number; y: number }> {
  const nums = pointsStr
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    if (Number.isFinite(nums[i]) && Number.isFinite(nums[i + 1])) {
      points.push({ x: nums[i], y: nums[i + 1] });
    }
  }
  return points;
}

/** Convert a list of 2D points (in SVG space, pre-transformed) to a path cutout spec. */
export function pointsToPathSpec(
  points: Array<{ x: number; y: number }>,
  viewBox: ViewBox
): ParsedCutoutSpec | null {
  if (points.length < 3) return null;

  const pathPoints: PathPoint[] = points.map((p) => ({
    x: p.x,
    y: flipY(p.y, viewBox),
    handleIn: null,
    handleOut: null,
    symmetric: false,
  }));

  return pathPointsToSpec(pathPoints);
}

/**
 * Build a path spec with bounds from the flattened bezier curve.
 *
 * Anchor-only bounds clip cutouts whose curves bow outward beyond their
 * anchors (logos, organic shapes), producing a too-small bbox that breaks
 * selection handles and downstream geometry placement. `getPathBounds`
 * flattens the curve, matching what the renderer / vertex editor compute.
 */
export function pathPointsToSpec(pathPoints: PathPoint[]): ParsedCutoutSpec | null {
  if (pathPoints.length < 2) return null;

  const { minX, minY, maxX, maxY } = getPathBounds(pathPoints);
  const width = maxX - minX;
  const depth = maxY - minY;

  if (width < 0.01 || depth < 0.01) return null;

  return {
    shape: 'path',
    x: minX,
    y: minY,
    width,
    depth,
    cornerRadius: 0,
    rotation: 0,
    path: pathPoints,
  };
}

/** Approximate an ellipse as 4 cubic bezier path points. */
function convertCircleAsPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  matrix: Matrix,
  viewBox: ViewBox
): ParsedCutoutSpec | null {
  // Magic number for bezier circle approximation: 4/3 * (sqrt(2) - 1)
  const k = 0.5523;
  const kx = rx * k;
  const ky = ry * k;

  // 4 anchor points at cardinal positions, with control handles
  const anchors: Array<{
    x: number;
    y: number;
    inDx: number;
    inDy: number;
    outDx: number;
    outDy: number;
  }> = [
    { x: cx + rx, y: cy, inDx: 0, inDy: -ky, outDx: 0, outDy: ky },
    { x: cx, y: cy + ry, inDx: kx, inDy: 0, outDx: -kx, outDy: 0 },
    { x: cx - rx, y: cy, inDx: 0, inDy: ky, outDx: 0, outDy: -ky },
    { x: cx, y: cy - ry, inDx: -kx, inDy: 0, outDx: kx, outDy: 0 },
  ];

  const pathPoints: PathPoint[] = anchors.map((a) => {
    const pt = transformPoint(a.x, a.y, matrix, viewBox);
    const hIn = transformPoint(a.x + a.inDx, a.y + a.inDy, matrix, viewBox);
    const hOut = transformPoint(a.x + a.outDx, a.y + a.outDy, matrix, viewBox);
    return {
      x: pt.x,
      y: pt.y,
      handleIn: { dx: hIn.x - pt.x, dy: hIn.y - pt.y },
      handleOut: { dx: hOut.x - pt.x, dy: hOut.y - pt.y },
      symmetric: false,
    };
  });

  return pathPointsToSpec(pathPoints);
}

export function convertRect(
  el: Element,
  matrix: Matrix,
  viewBox: ViewBox
): ParsedCutoutSpec | null {
  const x = numAttr(el, 'x');
  const y = numAttr(el, 'y');
  const w = numAttr(el, 'width');
  const h = numAttr(el, 'height');
  // SVG spec: if rx or ry is absent, it defaults to the other.
  // Our cutout system only supports circular corners, so use the larger value.
  const rxAttr = numAttr(el, 'rx');
  const ryAttr = numAttr(el, 'ry');
  const cornerR = Math.max(0, rxAttr, ryAttr);

  if (w <= 0 || h <= 0) return null;

  // Apply transform in original SVG space, then adjust for viewBox
  if (isIdentityOrTranslate(matrix)) {
    const translated = applyMatrix(matrix, x, y);
    return {
      shape: 'rectangle',
      x: translated.x - viewBox.minX,
      y: flipY(translated.y - viewBox.minY + h, viewBox),
      width: w,
      depth: h,
      cornerRadius: Math.min(cornerR, Math.min(w, h) / 2),
      rotation: 0,
    };
  }

  // Complex transform: convert to path
  const corners = [
    applyMatrix(matrix, x, y),
    applyMatrix(matrix, x + w, y),
    applyMatrix(matrix, x + w, y + h),
    applyMatrix(matrix, x, y + h),
  ].map((c) => ({ x: c.x - viewBox.minX, y: c.y - viewBox.minY }));

  return pointsToPathSpec(corners, viewBox);
}

export function convertCircle(
  el: Element,
  matrix: Matrix,
  viewBox: ViewBox
): ParsedCutoutSpec | null {
  const cx = numAttr(el, 'cx');
  const cy = numAttr(el, 'cy');
  const r = numAttr(el, 'r');

  if (r <= 0) return null;

  if (isIdentityOrTranslate(matrix)) {
    const center = applyMatrix(matrix, cx, cy);
    return {
      shape: 'circle',
      x: center.x - viewBox.minX - r,
      y: flipY(center.y - viewBox.minY + r, viewBox),
      width: r * 2,
      depth: r * 2,
      cornerRadius: 0,
      rotation: 0,
    };
  }

  return convertCircleAsPath(cx, cy, r, r, matrix, viewBox);
}

export function convertEllipse(
  el: Element,
  matrix: Matrix,
  viewBox: ViewBox
): ParsedCutoutSpec | null {
  const cx = numAttr(el, 'cx');
  const cy = numAttr(el, 'cy');
  const rx = numAttr(el, 'rx');
  const ry = numAttr(el, 'ry');

  if (rx <= 0 || ry <= 0) return null;

  if (isIdentityOrTranslate(matrix)) {
    const center = applyMatrix(matrix, cx, cy);
    return {
      shape: 'circle',
      x: center.x - viewBox.minX - rx,
      y: flipY(center.y - viewBox.minY + ry, viewBox),
      width: rx * 2,
      depth: ry * 2,
      cornerRadius: 0,
      rotation: 0,
    };
  }

  return convertCircleAsPath(cx, cy, rx, ry, matrix, viewBox);
}

export function convertPointsElement(
  el: Element,
  matrix: Matrix,
  viewBox: ViewBox
): ParsedCutoutSpec | null {
  const points = parsePointsAttr(el.getAttribute('points') ?? '');
  if (points.length < 3) return null;

  const transformed = points.map((p) => {
    const t = applyMatrix(matrix, p.x, p.y);
    return { x: t.x - viewBox.minX, y: t.y - viewBox.minY };
  });
  return pointsToPathSpec(transformed, viewBox);
}
