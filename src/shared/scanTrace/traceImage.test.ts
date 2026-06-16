import { describe, it, expect } from 'vitest';
import { isOk, isErr } from '@/core/result';
import { traceToPoints, traceImage, polygonArea, pointsToSvgPath } from './traceImage';
import type { ImageDataLike, Point } from './types';

function img(
  w: number,
  h: number,
  isObj: (x: number, y: number) => boolean,
  obj: readonly [number, number, number, number] = [0, 0, 0, 255],
  bg: readonly [number, number, number, number] = [255, 255, 255, 255]
): ImageDataLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const c = isObj(x, y) ? obj : bg;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = c[3];
    }
  }
  return { width: w, height: h, data };
}

function bbox(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  return points.reduce(
    (acc, p) => ({
      minX: Math.min(acc.minX, p.x),
      minY: Math.min(acc.minY, p.y),
      maxX: Math.max(acc.maxX, p.x),
      maxY: Math.max(acc.maxY, p.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

const rect = (x: number, y: number): boolean => x >= 5 && x <= 16 && y >= 4 && y <= 13;

describe('traceToPoints', () => {
  it('traces a dark rectangle on white to its bounding box', () => {
    const result = traceToPoints(img(24, 20, rect));
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(bbox(result.value)).toEqual({ minX: 5, minY: 4, maxX: 16, maxY: 13 });
    expect(result.value.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });

  it('traces a light object on a dark background', () => {
    const result = traceToPoints(img(24, 20, rect, [255, 255, 255, 255], [10, 10, 10, 255]));
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(bbox(result.value)).toEqual({ minX: 5, minY: 4, maxX: 16, maxY: 13 });
  });

  it('preserves concavity for an L-shape', () => {
    const isL = (x: number, y: number): boolean =>
      (x >= 4 && x <= 9 && y >= 4 && y <= 15) || (x >= 4 && x <= 15 && y >= 12 && y <= 15);
    const result = traceToPoints(img(24, 22, isL));
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const b = bbox(result.value);
    const bboxArea = (b.maxX - b.minX) * (b.maxY - b.minY);
    // A filled rectangle would cover the whole bbox; an L covers well under it.
    expect(polygonArea(result.value)).toBeLessThan(bboxArea * 0.85);
    expect(result.value.length).toBeGreaterThan(4);
  });

  it('ignores speckle and traces only the main object', () => {
    const withNoise = (x: number, y: number): boolean =>
      rect(x, y) || (x === 1 && y === 1) || (x === 22 && y === 18);
    const result = traceToPoints(img(24, 20, withNoise));
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(bbox(result.value)).toEqual({ minX: 5, minY: 4, maxX: 16, maxY: 13 });
  });

  it('reports NO_OBJECT for a blank image', () => {
    const result = traceToPoints(img(20, 20, () => false));
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('NO_OBJECT');
  });

  it('reports NO_OBJECT when the object is below the minimum area', () => {
    const result = traceToPoints(
      img(20, 20, (x, y) => x === 5 && y === 5),
      { minAreaPx: 16 }
    );
    expect(isErr(result)).toBe(true);
  });
});

describe('pointsToSvgPath', () => {
  it('builds a closed move/line path', () => {
    const d = pointsToSvgPath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(d).toBe('M0 0 L10 0 L10 10 Z');
  });
});

describe('traceImage', () => {
  it('emits a parseable single-path SVG with a pixel viewBox', () => {
    const result = traceImage(img(24, 20, rect));
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    expect(result.value.startsWith('<svg')).toBe(true);
    expect(result.value).toContain('viewBox="0 0 24 20"');

    // Exactly one closed path whose `d` is a well-formed move/line/close.
    const paths = result.value.match(/<path /g) ?? [];
    expect(paths).toHaveLength(1);
    const d = result.value.match(/<path d="([^"]+)"\s*\/>/)?.[1] ?? '';
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });
});
