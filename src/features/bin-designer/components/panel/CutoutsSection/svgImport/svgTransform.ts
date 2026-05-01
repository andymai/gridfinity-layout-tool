/**
 * SVG transform-attribute resolution.
 *
 * Parses `transform="..."` attributes (translate, scale, rotate, skewX/Y,
 * matrix) into 2D affine matrices, then walks the element ancestor chain
 * to resolve the cumulative transform up to the SVG root.
 *
 * The matrix tuple is `[a, b, c, d, e, f]` matching SVG's
 * `matrix(a,b,c,d,e,f)` convention; multiplication is column-major
 * (m1 ∘ m2 means "first apply m2, then m1").
 */

import type { ViewBox } from './types';

/** 2D affine transform as [a, b, c, d, e, f] matching SVG matrix(a,b,c,d,e,f). */
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY: Matrix = Object.freeze([1, 0, 0, 1, 0, 0]) as unknown as Matrix;

export function multiplyMatrices(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

export function applyMatrix(m: Matrix, x: number, y: number): { x: number; y: number } {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5],
  };
}

/** Parse a single SVG transform function into a matrix. */
function parseTransformFunction(fn: string): Matrix {
  const match = fn.trim().match(/^(\w+)\(([^)]*)\)/);
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
  const functions = transformAttr.match(/\w+\([^)]*\)/g);
  if (!functions) return IDENTITY;

  let result: Matrix = IDENTITY;
  for (const fn of functions) {
    result = multiplyMatrices(result, parseTransformFunction(fn));
  }
  return result;
}

/** Walk from element to svgRoot, accumulating transform matrices. */
export function resolveTransformChain(el: Element, svgRoot: Element): Matrix {
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

/** Apply a transform plus the viewBox + Y-flip needed for cutout coords. */
export function transformPoint(
  x: number,
  y: number,
  matrix: Matrix,
  viewBox: ViewBox
): { x: number; y: number } {
  const t = applyMatrix(matrix, x, y);
  return { x: t.x - viewBox.minX, y: viewBox.height - (t.y - viewBox.minY) };
}

export function isIdentityOrTranslate(m: Matrix): boolean {
  return (
    Math.abs(m[0] - 1) < 1e-6 &&
    Math.abs(m[1]) < 1e-6 &&
    Math.abs(m[2]) < 1e-6 &&
    Math.abs(m[3] - 1) < 1e-6
  );
}
