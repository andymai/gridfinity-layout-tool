/**
 * `resolveTransformChain` walks real DOM ancestors.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import {
  applyMatrix,
  isIdentityOrTranslate,
  multiplyMatrices,
  resolveTransformChain,
  transformPoint,
  IDENTITY,
  type Matrix,
} from './svgMatrix';
import type { ViewBox } from './types';

const VB: ViewBox = { minX: 0, minY: 0, width: 100, height: 100 };

/** Parse SVG markup and hand back the root plus the element with `id="t"`. */
function parse(markup: string): { root: SVGSVGElement; target: Element } {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`,
    'image/svg+xml'
  );
  const root = doc.querySelector('svg') as SVGSVGElement;
  return { root, target: doc.querySelector('#t') as Element };
}

const chainFor = (markup: string): Matrix => {
  const { root, target } = parse(markup);
  return resolveTransformChain(target, root);
};

describe('applyMatrix', () => {
  it('leaves a point alone under the identity', () => {
    expect(applyMatrix(IDENTITY, 7, 11)).toEqual({ x: 7, y: 11 });
  });

  it('applies scale, translate and rotate as SVG defines them', () => {
    expect(applyMatrix([2, 0, 0, 3, 0, 0], 4, 5)).toEqual({ x: 8, y: 15 });
    expect(applyMatrix([1, 0, 0, 1, 10, -4], 4, 5)).toEqual({ x: 14, y: 1 });
  });
});

describe('multiplyMatrices', () => {
  // Column-major: m1 ∘ m2 means "apply m2 first". Getting this backwards puts
  // a rotated, translated shape in the wrong place entirely.
  it('applies the right-hand matrix first', () => {
    const translate: Matrix = [1, 0, 0, 1, 10, 0];
    const scale: Matrix = [2, 0, 0, 2, 0, 0];
    // Scale then translate: (1,0) → (2,0) → (12,0).
    expect(applyMatrix(multiplyMatrices(translate, scale), 1, 0)).toEqual({ x: 12, y: 0 });
    // Translate then scale: (1,0) → (11,0) → (22,0).
    expect(applyMatrix(multiplyMatrices(scale, translate), 1, 0)).toEqual({ x: 22, y: 0 });
  });
});

describe('resolveTransformChain', () => {
  it('returns the identity when nothing is transformed', () => {
    expect(chainFor('<rect id="t" />')).toEqual(IDENTITY);
  });

  it('reads each transform function', () => {
    expect(applyMatrix(chainFor('<rect id="t" transform="translate(5 7)" />'), 0, 0)).toEqual({
      x: 5,
      y: 7,
    });
    expect(applyMatrix(chainFor('<rect id="t" transform="scale(3)" />'), 2, 4)).toEqual({
      x: 6,
      y: 12,
    });
    const rotated = applyMatrix(chainFor('<rect id="t" transform="rotate(90)" />'), 1, 0);
    expect(rotated.x).toBeCloseTo(0, 9);
    expect(rotated.y).toBeCloseTo(1, 9);
  });

  it('rotates about a given centre', () => {
    const p = applyMatrix(chainFor('<rect id="t" transform="rotate(180 5 5)" />'), 5, 0);
    expect(p.x).toBeCloseTo(5, 9);
    expect(p.y).toBeCloseTo(10, 9);
  });

  it('composes several functions in one attribute, left to right', () => {
    // translate then scale: (1,1) → (2,2) → (12,2).
    const p = applyMatrix(chainFor('<rect id="t" transform="translate(10 0) scale(2)" />'), 1, 1);
    expect(p).toEqual({ x: 12, y: 2 });
  });

  // A CAD-exported SVG nests the drawing in transformed groups, so the walk has
  // to accumulate every ancestor up to the root.
  it('accumulates transforms from ancestor groups', () => {
    const p = applyMatrix(
      chainFor('<g transform="translate(10 10)"><g transform="scale(2)"><rect id="t" /></g></g>'),
      1,
      1
    );
    expect(p).toEqual({ x: 12, y: 12 });
  });

  it('ignores an unknown transform function rather than throwing', () => {
    expect(chainFor('<rect id="t" transform="warp(3)" />')).toEqual(IDENTITY);
  });
});

describe('transformPoint', () => {
  // Both importers store Y-up geometry with the origin at the viewBox's
  // bottom-left, while SVG itself is Y-down from the top-left.
  it('flips Y and rebases on the viewBox origin', () => {
    expect(transformPoint(10, 0, IDENTITY, VB)).toEqual({ x: 10, y: 100 });
    expect(transformPoint(10, 100, IDENTITY, VB)).toEqual({ x: 10, y: 0 });
  });

  it('subtracts a non-zero viewBox origin', () => {
    const offset: ViewBox = { minX: 5, minY: 5, width: 100, height: 100 };
    expect(transformPoint(15, 5, IDENTITY, offset)).toEqual({ x: 10, y: 100 });
  });
});

describe('isIdentityOrTranslate', () => {
  it('accepts a pure translation but not a scale or rotation', () => {
    expect(isIdentityOrTranslate(IDENTITY)).toBe(true);
    expect(isIdentityOrTranslate([1, 0, 0, 1, 30, -8])).toBe(true);
    expect(isIdentityOrTranslate([2, 0, 0, 2, 0, 0])).toBe(false);
    expect(isIdentityOrTranslate([0, 1, -1, 0, 0, 0])).toBe(false);
  });
});
