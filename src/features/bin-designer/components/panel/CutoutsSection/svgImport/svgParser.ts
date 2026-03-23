/**
 * Pure SVG → ParsedCutoutSpec[] parser.
 *
 * Parses an SVG string and extracts geometric elements (rect, circle, ellipse,
 * polygon, polyline, path) as intermediate cutout specs. Non-geometric elements
 * (text, image, defs) are ignored.
 *
 * No React, no store, no side effects. Testable with jsdom's DOMParser.
 */

import { SVGPathData, SVGPathDataTransformer } from 'svg-pathdata';
import type { SVGCommand } from 'svg-pathdata';
import { SVGPathData as SVGPathDataEnum } from 'svg-pathdata';
import type { Result } from '@/core/result';
import { ok, err } from '@/core/result';
import type { PathPoint } from '@/features/bin-designer/types';
import type { ParsedCutoutSpec, SvgImportError } from './types';
import { MAX_SVG_SHAPES } from './types';

/**
 * Geometric SVG elements, excluding those inside non-rendered containers.
 * The :not() selectors filter out shapes inside defs, clipPath, mask, symbol, and pattern.
 */
const GEOMETRIC_SELECTOR = ['rect', 'circle', 'ellipse', 'polygon', 'polyline', 'path']
  .map((tag) => `${tag}:not(defs *, clipPath *, mask *, symbol *, pattern *)`)
  .join(', ');

/**
 * Parse an SVG string into intermediate cutout specs.
 *
 * @param svgString - Raw SVG file content
 * @returns Result with specs on success, SvgImportError on failure
 */
export function parseSvgString(svgString: string): Result<ParsedCutoutSpec[], SvgImportError> {
  // Parse SVG XML
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    return err({ code: 'SVG_PARSE_FAILED', detail: parseError.textContent ?? undefined });
  }

  const svgRoot = doc.querySelector('svg');
  if (!svgRoot) {
    return err({ code: 'SVG_UNSUPPORTED', detail: 'No <svg> root element found' });
  }

  // Collect geometric elements (selector excludes non-rendered containers like defs)
  const elements = svgRoot.querySelectorAll(GEOMETRIC_SELECTOR);

  if (elements.length === 0) {
    return err({ code: 'SVG_NO_SHAPES', detail: 'No geometric elements found' });
  }

  if (elements.length > MAX_SVG_SHAPES) {
    return err({
      code: 'SVG_SHAPE_LIMIT',
      detail: `Found ${elements.length} shapes, max is ${MAX_SVG_SHAPES}`,
    });
  }

  // Resolve SVG viewBox for coordinate mapping
  const viewBox = parseViewBox(svgRoot);

  const specs: ParsedCutoutSpec[] = [];

  for (const el of elements) {
    try {
      // Resolve accumulated transform from element to svg root
      const matrix = resolveTransformChain(el, svgRoot);
      const converted = convertElement(el, matrix, viewBox);
      if (converted) {
        specs.push(...converted);
      }
    } catch {
      // Skip individual elements that fail conversion
    }
  }

  if (specs.length === 0) {
    return err({ code: 'SVG_NO_SHAPES', detail: 'All shapes failed conversion' });
  }

  // Guard against multi-contour paths expanding beyond the element-count limit
  if (specs.length > MAX_SVG_SHAPES) {
    return err({
      code: 'SVG_SHAPE_LIMIT',
      detail: `Produced ${specs.length} cutouts, max is ${MAX_SVG_SHAPES}`,
    });
  }

  return ok(specs);
}

// ─── ViewBox ─────────────────────────────────────────────────────────────────

interface ViewBox {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

function parseViewBox(svg: SVGSVGElement): ViewBox {
  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const parts = vb
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (
      parts.length === 4 &&
      parts.every((n) => Number.isFinite(n)) &&
      parts[2] > 0 &&
      parts[3] > 0
    ) {
      return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
    }
  }

  // Fallback to width/height attributes
  const w = parseFloat(svg.getAttribute('width') ?? '0');
  const h = parseFloat(svg.getAttribute('height') ?? '0');
  return { minX: 0, minY: 0, width: w || 100, height: h || 100 };
}

// ─── Transform Resolution ────────────────────────────────────────────────────

/** 2D affine transform as [a, b, c, d, e, f] matching SVG matrix(a,b,c,d,e,f). */
type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiplyMatrices(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyMatrix(m: Matrix, x: number, y: number): { x: number; y: number } {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5],
  };
}

/** Parse a single SVG transform function into a matrix. */
function parseTransformFunction(fn: string): Matrix {
  const match = /^(\w+)\(([^)]*)\)/.exec(fn.trim());
  if (!match) return IDENTITY;

  const name = match[1];
  const args = match[2].split(/[\s,]+/).map(Number);

  switch (name) {
    case 'translate':
      return [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0];
    case 'scale': {
      const sx = args[0] ?? 1;
      const sy = args[1] ?? sx;
      return [sx, 0, 0, sy, 0, 0];
    }
    case 'rotate': {
      const angle = ((args[0] ?? 0) * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      if (args.length >= 3) {
        const cx = args[1];
        const cy = args[2];
        // rotate(angle, cx, cy) = translate(cx,cy) rotate(angle) translate(-cx,-cy)
        return [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy];
      }
      return [cos, sin, -sin, cos, 0, 0];
    }
    case 'matrix':
      if (args.length >= 6) {
        return [args[0], args[1], args[2], args[3], args[4], args[5]];
      }
      return IDENTITY;
    case 'skewX': {
      const a = Math.tan(((args[0] ?? 0) * Math.PI) / 180);
      return [1, 0, a, 1, 0, 0];
    }
    case 'skewY': {
      const a = Math.tan(((args[0] ?? 0) * Math.PI) / 180);
      return [1, a, 0, 1, 0, 0];
    }
    default:
      return IDENTITY;
  }
}

/** Parse the full `transform` attribute (may contain multiple functions). */
function parseTransformAttr(transformAttr: string): Matrix {
  // Match individual transform functions
  const functions = transformAttr.match(/\w+\([^)]*\)/g);
  if (!functions) return IDENTITY;

  let result: Matrix = IDENTITY;
  for (const fn of functions) {
    result = multiplyMatrices(result, parseTransformFunction(fn));
  }
  return result;
}

/** Walk from element to svgRoot, accumulating transform matrices. */
function resolveTransformChain(el: Element, svgRoot: Element): Matrix {
  const chain: Matrix[] = [];
  let current: Element | null = el;

  while (current && current !== svgRoot) {
    const transformAttr = current.getAttribute('transform');
    if (transformAttr) {
      chain.unshift(parseTransformAttr(transformAttr));
    }
    current = current.parentElement;
  }

  let result: Matrix = IDENTITY;
  for (const m of chain) {
    result = multiplyMatrices(result, m);
  }
  return result;
}

// ─── Element Conversion ──────────────────────────────────────────────────────

function convertElement(el: Element, matrix: Matrix, viewBox: ViewBox): ParsedCutoutSpec[] | null {
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case 'rect':
      return wrapSingle(convertRect(el, matrix, viewBox));
    case 'circle':
      return wrapSingle(convertCircle(el, matrix, viewBox));
    case 'ellipse':
      return wrapSingle(convertEllipse(el, matrix, viewBox));
    case 'polygon':
    case 'polyline':
      return wrapSingle(convertPointsElement(el, matrix, viewBox));
    case 'path':
      return convertPath(el, matrix, viewBox);
    default:
      return null;
  }
}

function wrapSingle(spec: ParsedCutoutSpec | null): ParsedCutoutSpec[] | null {
  return spec ? [spec] : null;
}

function numAttr(el: Element, name: string, fallback = 0): number {
  return parseFloat(el.getAttribute(name) ?? '') || fallback;
}

/** Flip Y from SVG coordinate space (Y-down) to cutout space (Y-up from viewBox bottom). */
function flipY(y: number, viewBox: ViewBox): number {
  return viewBox.height - y;
}

function convertRect(el: Element, matrix: Matrix, viewBox: ViewBox): ParsedCutoutSpec | null {
  const x = numAttr(el, 'x');
  const y = numAttr(el, 'y');
  const w = numAttr(el, 'width');
  const h = numAttr(el, 'height');
  const rx = numAttr(el, 'rx');

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
      cornerRadius: Math.min(rx, Math.min(w, h) / 2),
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

function convertCircle(el: Element, matrix: Matrix, viewBox: ViewBox): ParsedCutoutSpec | null {
  const cx = numAttr(el, 'cx');
  const cy = numAttr(el, 'cy');
  const r = numAttr(el, 'r');

  if (r <= 0) return null;

  // Apply transform in original SVG space, then adjust for viewBox
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

function convertEllipse(el: Element, matrix: Matrix, viewBox: ViewBox): ParsedCutoutSpec | null {
  const cx = numAttr(el, 'cx');
  const cy = numAttr(el, 'cy');
  const rx = numAttr(el, 'rx');
  const ry = numAttr(el, 'ry');

  if (rx <= 0 || ry <= 0) return null;

  // Apply transform in original SVG space, then adjust for viewBox
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

function convertPointsElement(
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

function convertPath(el: Element, matrix: Matrix, viewBox: ViewBox): ParsedCutoutSpec[] | null {
  const d = el.getAttribute('d');
  if (!d) return null;

  // Parse and normalize path data
  const pathData = new SVGPathData(d).transform(SVGPathDataTransformer.NORMALIZE_HVZ()).toAbs();

  // Split into sub-paths (each M starts a new contour)
  const contours = splitContours(pathData.commands);
  const specs: ParsedCutoutSpec[] = [];

  for (const contour of contours) {
    const spec = convertContour(contour, matrix, viewBox);
    if (spec) {
      specs.push(spec);
    }
  }

  return specs.length > 0 ? specs : null;
}

// ─── Path Command Processing ─────────────────────────────────────────────────

/** Split path commands into separate contours (each starting with M). */
function splitContours(commands: SVGCommand[]): SVGCommand[][] {
  const contours: SVGCommand[][] = [];
  let current: SVGCommand[] = [];

  for (const cmd of commands) {
    if (cmd.type === SVGPathDataEnum.MOVE_TO && current.length > 0) {
      contours.push(current);
      current = [];
    }
    current.push(cmd);
  }

  if (current.length > 0) {
    contours.push(current);
  }

  return contours;
}

/** Convert a single path contour to a cutout spec. */
function convertContour(
  commands: SVGCommand[],
  matrix: Matrix,
  viewBox: ViewBox
): ParsedCutoutSpec | null {
  if (commands.length < 2) return null;

  const pathPoints: PathPoint[] = [];
  let currentX = 0;
  let currentY = 0;

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];

    switch (cmd.type) {
      case SVGPathDataEnum.MOVE_TO:
      case SVGPathDataEnum.LINE_TO: {
        currentX = cmd.x;
        currentY = cmd.y;
        pathPoints.push(makeCornerPoint(currentX, currentY, matrix, viewBox));
        break;
      }

      case SVGPathDataEnum.CURVE_TO: {
        // Cubic bezier: C x1 y1 x2 y2 x y
        // cp1 = (cmd.x1, cmd.y1) — outgoing handle of PREVIOUS point
        // cp2 = (cmd.x2, cmd.y2) — incoming handle of THIS point
        const cp1 = transformPoint(cmd.x1, cmd.y1, matrix, viewBox);
        const cp2 = transformPoint(cmd.x2, cmd.y2, matrix, viewBox);
        const endPt = transformPoint(cmd.x, cmd.y, matrix, viewBox);

        // Set handleOut on previous point
        if (pathPoints.length > 0) {
          const prev = pathPoints[pathPoints.length - 1];
          pathPoints[pathPoints.length - 1] = {
            ...prev,
            handleOut: { dx: cp1.x - prev.x, dy: cp1.y - prev.y },
            symmetric: false,
          };
        }

        // Add new point with handleIn
        pathPoints.push({
          x: endPt.x,
          y: endPt.y,
          handleIn: { dx: cp2.x - endPt.x, dy: cp2.y - endPt.y },
          handleOut: null,
          symmetric: false,
        });

        currentX = cmd.x;
        currentY = cmd.y;
        break;
      }

      case SVGPathDataEnum.QUAD_TO: {
        // Quadratic bezier: Q x1 y1 x y → elevate to cubic
        const qcp = { x: cmd.x1, y: cmd.y1 };
        const qend = { x: cmd.x, y: cmd.y };
        const cp1x = currentX + (2 / 3) * (qcp.x - currentX);
        const cp1y = currentY + (2 / 3) * (qcp.y - currentY);
        const cp2x = qend.x + (2 / 3) * (qcp.x - qend.x);
        const cp2y = qend.y + (2 / 3) * (qcp.y - qend.y);

        const tCp1 = transformPoint(cp1x, cp1y, matrix, viewBox);
        const tCp2 = transformPoint(cp2x, cp2y, matrix, viewBox);
        const tEnd = transformPoint(qend.x, qend.y, matrix, viewBox);

        if (pathPoints.length > 0) {
          const prev = pathPoints[pathPoints.length - 1];
          pathPoints[pathPoints.length - 1] = {
            ...prev,
            handleOut: { dx: tCp1.x - prev.x, dy: tCp1.y - prev.y },
            symmetric: false,
          };
        }

        pathPoints.push({
          x: tEnd.x,
          y: tEnd.y,
          handleIn: { dx: tCp2.x - tEnd.x, dy: tCp2.y - tEnd.y },
          handleOut: null,
          symmetric: false,
        });

        currentX = cmd.x;
        currentY = cmd.y;
        break;
      }

      case SVGPathDataEnum.ARC: {
        // Convert arc to cubic bezier segments
        const arcBeziers = arcToCubicBeziers(
          currentX,
          currentY,
          cmd.rX,
          cmd.rY,
          cmd.xRot,
          cmd.lArcFlag ? 1 : 0,
          cmd.sweepFlag ? 1 : 0,
          cmd.x,
          cmd.y
        );

        for (const seg of arcBeziers) {
          const tCp1 = transformPoint(seg.cp1x, seg.cp1y, matrix, viewBox);
          const tCp2 = transformPoint(seg.cp2x, seg.cp2y, matrix, viewBox);
          const tEnd = transformPoint(seg.x, seg.y, matrix, viewBox);

          if (pathPoints.length > 0) {
            const prev = pathPoints[pathPoints.length - 1];
            pathPoints[pathPoints.length - 1] = {
              ...prev,
              handleOut: { dx: tCp1.x - prev.x, dy: tCp1.y - prev.y },
              symmetric: false,
            };
          }

          pathPoints.push({
            x: tEnd.x,
            y: tEnd.y,
            handleIn: { dx: tCp2.x - tEnd.x, dy: tCp2.y - tEnd.y },
            handleOut: null,
            symmetric: false,
          });
        }

        currentX = cmd.x;
        currentY = cmd.y;
        break;
      }

      case SVGPathDataEnum.CLOSE_PATH: {
        // Remove duplicate endpoint if it matches the first point
        if (pathPoints.length >= 2) {
          const first = pathPoints[0];
          const last = pathPoints[pathPoints.length - 1];
          const dx = Math.abs(first.x - last.x);
          const dy = Math.abs(first.y - last.y);
          if (dx < 0.01 && dy < 0.01) {
            // Transfer handleIn from duplicate endpoint to first point
            const removed = pathPoints.pop();
            if (removed?.handleIn) {
              pathPoints[0] = { ...pathPoints[0], handleIn: removed.handleIn };
            }
          }
        }
        break;
      }
    }
  }

  if (pathPoints.length < 2) return null;

  return pathPointsToSpec(pathPoints);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function transformPoint(
  x: number,
  y: number,
  matrix: Matrix,
  viewBox: ViewBox
): { x: number; y: number } {
  // Apply transform in original SVG user space, then adjust for viewBox
  const t = applyMatrix(matrix, x, y);
  return { x: t.x - viewBox.minX, y: flipY(t.y - viewBox.minY, viewBox) };
}

function makeCornerPoint(x: number, y: number, matrix: Matrix, viewBox: ViewBox): PathPoint {
  const t = transformPoint(x, y, matrix, viewBox);
  return { x: t.x, y: t.y, handleIn: null, handleOut: null, symmetric: false };
}

function isIdentityOrTranslate(m: Matrix): boolean {
  return (
    Math.abs(m[0] - 1) < 1e-6 &&
    Math.abs(m[1]) < 1e-6 &&
    Math.abs(m[2]) < 1e-6 &&
    Math.abs(m[3] - 1) < 1e-6
  );
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
function pointsToPathSpec(
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

/** Compute bounds from anchor points (does not account for bezier handle extents). */
function pathPointsToSpec(pathPoints: PathPoint[]): ParsedCutoutSpec | null {
  if (pathPoints.length < 2) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pt of pathPoints) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }

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
    { x: cx + rx, y: cy, inDx: 0, inDy: -ky, outDx: 0, outDy: ky }, // right
    { x: cx, y: cy + ry, inDx: kx, inDy: 0, outDx: -kx, outDy: 0 }, // bottom
    { x: cx - rx, y: cy, inDx: 0, inDy: ky, outDx: 0, outDy: -ky }, // left
    { x: cx, y: cy - ry, inDx: -kx, inDy: 0, outDx: kx, outDy: 0 }, // top
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

// ─── Arc to Cubic Bezier Conversion ──────────────────────────────────────────

interface BezierSegment {
  readonly cp1x: number;
  readonly cp1y: number;
  readonly cp2x: number;
  readonly cp2y: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Convert an SVG arc command to cubic bezier segments.
 * Based on the W3C SVG arc implementation notes.
 */
function arcToCubicBeziers(
  x1: number,
  y1: number,
  _rx: number,
  _ry: number,
  xRotDeg: number,
  largeArc: number,
  sweep: number,
  x2: number,
  y2: number
): BezierSegment[] {
  if (Math.abs(x1 - x2) < 1e-6 && Math.abs(y1 - y2) < 1e-6) return [];

  let rx = Math.abs(_rx);
  let ry = Math.abs(_ry);
  if (rx < 1e-6 || ry < 1e-6) {
    // Degenerate arc: straight line
    return [
      {
        cp1x: x1 + (x2 - x1) / 3,
        cp1y: y1 + (y2 - y1) / 3,
        cp2x: x1 + (2 * (x2 - x1)) / 3,
        cp2y: y1 + (2 * (y2 - y1)) / 3,
        x: x2,
        y: y2,
      },
    ];
  }

  const phi = (xRotDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: Move to origin and un-rotate
  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  // Step 2: Scale radii if needed
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;
  let rxSq = rx * rx;
  let rySq = ry * ry;
  const lambda = x1pSq / rxSq + y1pSq / rySq;
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
    rxSq = rx * rx;
    rySq = ry * ry;
  }

  // Step 3: Compute center
  let sq = Math.max(0, (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq));
  sq = Math.sqrt(sq);
  if (largeArc === sweep) sq = -sq;

  const cxp = sq * ((rx * y1p) / ry);
  const cyp = sq * -((ry * x1p) / rx);

  // Step 4: Compute angles
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const theta1 = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = vectorAngle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry
  );

  if (sweep === 0 && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep === 1 && dTheta < 0) dTheta += 2 * Math.PI;

  // Split into segments of at most PI/2
  const segments = Math.ceil(Math.abs(dTheta) / (Math.PI / 2));
  const segAngle = dTheta / segments;
  const result: BezierSegment[] = [];

  let startAngle = theta1;
  for (let i = 0; i < segments; i++) {
    const endAngle = startAngle + segAngle;
    const bezier = arcSegmentToBezier(cx, cy, rx, ry, phi, startAngle, endAngle);
    result.push(bezier);
    startAngle = endAngle;
  }

  return result;
}

function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  const dot = ux * vx + uy * vy;
  const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
  return sign * Math.acos(Math.max(-1, Math.min(1, dot / len)));
}

function arcSegmentToBezier(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  phi: number,
  theta1: number,
  theta2: number
): BezierSegment {
  const alpha = (4 / 3) * Math.tan((theta2 - theta1) / 4);
  const cosPhi2 = Math.cos(phi);
  const sinPhi2 = Math.sin(phi);

  const cosT1 = Math.cos(theta1);
  const sinT1 = Math.sin(theta1);
  const cosT2 = Math.cos(theta2);
  const sinT2 = Math.sin(theta2);

  const ep1x = cx + cosPhi2 * rx * cosT1 - sinPhi2 * ry * sinT1;
  const ep1y = cy + sinPhi2 * rx * cosT1 + cosPhi2 * ry * sinT1;
  const ep2x = cx + cosPhi2 * rx * cosT2 - sinPhi2 * ry * sinT2;
  const ep2y = cy + sinPhi2 * rx * cosT2 + cosPhi2 * ry * sinT2;

  return {
    cp1x: ep1x + alpha * (-cosPhi2 * rx * sinT1 - sinPhi2 * ry * cosT1),
    cp1y: ep1y + alpha * (-sinPhi2 * rx * sinT1 + cosPhi2 * ry * cosT1),
    cp2x: ep2x + alpha * (cosPhi2 * rx * sinT2 + sinPhi2 * ry * cosT2),
    cp2y: ep2y + alpha * (sinPhi2 * rx * sinT2 - cosPhi2 * ry * cosT2),
    x: ep2x,
    y: ep2y,
  };
}
