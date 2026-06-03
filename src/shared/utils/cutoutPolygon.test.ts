import { describe, it, expect } from 'vitest';
import {
  clampPolygonSides,
  regularPolygonPoints,
  polygonBoxFromAcrossFlats,
  acrossFlatsFromBox,
  maxAcrossFlats,
  slotCornerRadius,
} from './cutoutPolygon';

function bounds(points: readonly { x: number; y: number }[]) {
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

describe('clampPolygonSides', () => {
  it('clamps to the supported [3, 12] range', () => {
    expect(clampPolygonSides(2)).toBe(3);
    expect(clampPolygonSides(13)).toBe(12);
    expect(clampPolygonSides(6)).toBe(6);
  });

  it('rounds fractional counts and defaults NaN to the minimum', () => {
    expect(clampPolygonSides(5.6)).toBe(6);
    expect(clampPolygonSides(Number.NaN)).toBe(3);
  });
});

describe('regularPolygonPoints', () => {
  it('emits one vertex per side', () => {
    expect(regularPolygonPoints(6, 10, 10)).toHaveLength(6);
    expect(regularPolygonPoints(3, 10, 10)).toHaveLength(3);
  });

  it('fills the requested bounding box exactly and centers on the origin', () => {
    const b = bounds(regularPolygonPoints(6, 20, 17.32));
    expect(b.maxX - b.minX).toBeCloseTo(20, 4);
    expect(b.maxY - b.minY).toBeCloseTo(17.32, 4);
    expect(b.minX + b.maxX).toBeCloseTo(0, 4);
    expect(b.minY + b.maxY).toBeCloseTo(0, 4);
  });

  it('orients a hexagon flat-top (two vertices share the top edge)', () => {
    const pts = regularPolygonPoints(6, 20, 20);
    const b = bounds(pts);
    const onTop = pts.filter((p) => Math.abs(p.y - b.maxY) < 1e-6);
    expect(onTop).toHaveLength(2);
  });

  it('returns empty for degenerate sizes', () => {
    expect(regularPolygonPoints(6, 0, 10)).toEqual([]);
    expect(regularPolygonPoints(6, 10, -1)).toEqual([]);
  });
});

describe('polygonBoxFromAcrossFlats', () => {
  it('maps across-flats to the depth (flat-to-flat) axis', () => {
    const box = polygonBoxFromAcrossFlats(6, 6.35);
    expect(box.depth).toBeCloseTo(6.35, 4);
    // Flat-top hexagon: point-to-point width = af * 2/sqrt(3)
    expect(box.width).toBeCloseTo(6.35 * (2 / Math.sqrt(3)), 3);
  });

  it('round-trips with acrossFlatsFromBox', () => {
    const box = polygonBoxFromAcrossFlats(8, 12);
    expect(acrossFlatsFromBox(8, box.depth)).toBeCloseTo(12, 6);
  });

  it('produces a regular polygon whose derived box matches across-flats', () => {
    const box = polygonBoxFromAcrossFlats(6, 10);
    const b = bounds(regularPolygonPoints(6, box.width, box.depth));
    expect(b.maxY - b.minY).toBeCloseTo(10, 4);
  });
});

describe('maxAcrossFlats', () => {
  it('is bound by width when the polygon is wider than it is tall', () => {
    // Hexagon aspect ≈1.1547 → width is the binding constraint when maxWidth==maxDepth.
    const af = maxAcrossFlats(6, 100, 100);
    const box = polygonBoxFromAcrossFlats(6, af);
    expect(box.width).toBeLessThanOrEqual(100 + 1e-6);
    expect(box.depth).toBeLessThanOrEqual(100 + 1e-6);
    expect(af).toBeLessThan(100); // width limit kicks in below the depth limit
  });

  it('keeps the resulting box regular within both bounds', () => {
    const af = maxAcrossFlats(6, 60, 200);
    const box = polygonBoxFromAcrossFlats(6, af);
    expect(box.width).toBeCloseTo(60, 4); // width-limited
  });

  it('never returns negative', () => {
    expect(maxAcrossFlats(6, 0, 0)).toBe(0);
  });
});

describe('slotCornerRadius', () => {
  it('is half the short side', () => {
    expect(slotCornerRadius(30, 10)).toBe(5);
    expect(slotCornerRadius(8, 20)).toBe(4);
  });

  it('never goes negative', () => {
    expect(slotCornerRadius(0, 0)).toBe(0);
  });
});
