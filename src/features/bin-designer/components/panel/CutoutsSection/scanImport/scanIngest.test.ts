import { describe, it, expect } from 'vitest';
import { isOk, isErr } from '@/core/result';
import { parseScanSvg, computeScanBounds, rescaleToLongestMm } from './scanIngest';
import type { ParsedCutoutSpec } from '../svgImport/types';

const RECT_100 = `<svg viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100"/></svg>`;
const RECT_WIDE = `<svg viewBox="0 0 200 100"><rect x="0" y="0" width="200" height="50"/></svg>`;
const EMPTY = `<svg viewBox="0 0 100 100"></svg>`;
const TRIANGLE = `<svg viewBox="0 0 80 60"><polygon points="0,0 80,0 40,60"/></svg>`;

function spec(partial: Partial<ParsedCutoutSpec>): ParsedCutoutSpec {
  return {
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    depth: 10,
    cornerRadius: 0,
    rotation: 0,
    ...partial,
  };
}

describe('computeScanBounds', () => {
  it('measures the union footprint across specs', () => {
    const bounds = computeScanBounds([
      spec({ x: 0, y: 0, width: 20, depth: 10 }),
      spec({ x: 30, y: 5, width: 10, depth: 40 }),
    ]);
    expect(bounds.width).toBe(40); // 0..40
    expect(bounds.depth).toBe(45); // 0..45
    expect(bounds.longest).toBe(45);
  });

  it('returns zero bounds for an empty spec list', () => {
    expect(computeScanBounds([])).toEqual({ width: 0, depth: 0, longest: 0 });
  });
});

describe('parseScanSvg', () => {
  it('parses a rectangle outline and measures its longest side', () => {
    const result = parseScanSvg(RECT_100);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.specs).toHaveLength(1);
    expect(result.value.bounds.longest).toBeCloseTo(100, 5);
  });

  it('measures the longest side of a non-square outline', () => {
    const result = parseScanSvg(RECT_WIDE);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.bounds.longest).toBeCloseTo(200, 5);
  });

  it('parses a polygon outline into a path spec', () => {
    const result = parseScanSvg(TRIANGLE);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.specs[0].shape).toBe('path');
    expect(result.value.bounds.longest).toBeCloseTo(80, 5);
  });

  it('rejects an SVG with no shapes', () => {
    const result = parseScanSvg(EMPTY);
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('SVG_NO_SHAPES');
  });

  it('rejects unparseable input', () => {
    const result = parseScanSvg('not an svg');
    expect(isErr(result)).toBe(true);
  });
});

describe('rescaleToLongestMm', () => {
  it('scales specs so the longest side hits the target', () => {
    const parsed = parseScanSvg(RECT_100);
    if (!isOk(parsed)) throw new Error('fixture failed to parse');
    const rescaled = rescaleToLongestMm(parsed.value.specs, parsed.value.bounds.longest, 50);
    expect(computeScanBounds(rescaled).longest).toBeCloseTo(50, 5);
  });

  it('scales bezier path handles in lockstep', () => {
    const withHandle = spec({
      shape: 'path',
      width: 100,
      depth: 100,
      path: [
        { x: 0, y: 0, handleIn: null, handleOut: { dx: 10, dy: 0 }, symmetric: false },
        { x: 100, y: 100, handleIn: { dx: -10, dy: 0 }, handleOut: null, symmetric: false },
      ],
    });
    const [scaled] = rescaleToLongestMm([withHandle], 100, 50);
    expect(scaled.path?.[0].handleOut).toEqual({ dx: 5, dy: 0 });
    expect(scaled.path?.[1].x).toBe(50);
  });

  it('is a no-op when target equals current size', () => {
    const specs = [spec({ width: 100, depth: 100 })];
    expect(rescaleToLongestMm(specs, 100, 100)).toEqual(specs);
  });

  it('returns specs unchanged for non-positive inputs', () => {
    const specs = [spec({})];
    expect(rescaleToLongestMm(specs, 0, 50)).toEqual(specs);
    expect(rescaleToLongestMm(specs, 100, 0)).toEqual(specs);
  });
});
