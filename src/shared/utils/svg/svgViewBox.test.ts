/**
 * Both helpers read attributes off a real `<svg>` element.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { parseViewBox, resolveUserUnitToMm } from './svgViewBox';

function svgEl(attrs: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}></svg>`,
    'image/svg+xml'
  );
  return doc.querySelector('svg') as SVGSVGElement;
}

describe('parseViewBox', () => {
  it('reads an explicit viewBox, origin included', () => {
    const r = parseViewBox(svgEl('viewBox="-10 -20 300 200"'));
    expect(r.hasExplicitViewBox).toBe(true);
    expect(r.viewBox).toEqual({ minX: -10, minY: -20, width: 300, height: 200 });
  });

  it('accepts commas between the four numbers', () => {
    expect(parseViewBox(svgEl('viewBox="0,0,50,25"')).viewBox.width).toBe(50);
  });

  // The fallback runs parseFloat, which silently drops a unit suffix, so it
  // must not be mistaken for a real viewBox — physical scaling would be wrong.
  it('falls back to width and height, flagged as not explicit', () => {
    const r = parseViewBox(svgEl('width="120" height="60"'));
    expect(r.hasExplicitViewBox).toBe(false);
    expect(r.viewBox).toEqual({ minX: 0, minY: 0, width: 120, height: 60 });
  });

  it('falls back again for a malformed or degenerate viewBox', () => {
    for (const attrs of ['viewBox="0 0 100"', 'viewBox="0 0 0 100"', 'viewBox="a b c d"']) {
      expect(parseViewBox(svgEl(attrs)).hasExplicitViewBox).toBe(false);
    }
  });

  it('uses 100 x 100 when there is nothing to go on', () => {
    expect(parseViewBox(svgEl('')).viewBox).toEqual({
      minX: 0,
      minY: 0,
      width: 100,
      height: 100,
    });
  });
});

describe('resolveUserUnitToMm', () => {
  const vb = { minX: 0, minY: 0, width: 100, height: 50 };

  it('derives the scale from physical dimensions', () => {
    expect(resolveUserUnitToMm(svgEl('width="200mm" height="100mm"'), vb)).toBeCloseTo(2, 9);
    // One inch across 100 user units.
    expect(resolveUserUnitToMm(svgEl('width="1in" height="0.5in"'), vb)).toBeCloseTo(0.254, 9);
  });

  // Without physical units, a user unit has historically meant 1mm; changing
  // that would silently resize every previously imported drawing.
  it('stays at 1 when the dimensions carry no physical unit', () => {
    expect(resolveUserUnitToMm(svgEl('width="200" height="100"'), vb)).toBe(1);
    expect(resolveUserUnitToMm(svgEl('width="200px" height="100px"'), vb)).toBe(1);
    expect(resolveUserUnitToMm(svgEl('width="50%" height="50%"'), vb)).toBe(1);
    expect(resolveUserUnitToMm(svgEl(''), vb)).toBe(1);
  });

  // One uniform scalar cannot honour non-uniform stretching without distorting
  // circles and rotated shapes, so 1:1 is the predictable answer.
  it('refuses to scale a genuinely non-square SVG', () => {
    expect(resolveUserUnitToMm(svgEl('width="200mm" height="200mm"'), vb)).toBe(1);
  });

  it('tolerates rounding between the two axes', () => {
    // 200.1 / 100 vs 100 / 50 — well inside the 0.5% tolerance.
    expect(resolveUserUnitToMm(svgEl('width="200.1mm" height="100mm"'), vb)).toBeCloseTo(2.0005, 6);
  });

  it('stays at 1 for a non-positive or non-finite scale', () => {
    expect(resolveUserUnitToMm(svgEl('width="0mm" height="0mm"'), vb)).toBe(1);
    expect(
      resolveUserUnitToMm(svgEl('width="10mm" height="5mm"'), { ...vb, width: 0, height: 0 })
    ).toBe(1);
  });
});
