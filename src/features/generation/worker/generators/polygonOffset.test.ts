import { describe, it, expect } from 'vitest';
import { offsetClosedPolygon, type Pt } from './polygonOffset';

const CCW_SQUARE: Pt[] = [
  { x: -5, y: -5 },
  { x: 5, y: -5 },
  { x: 5, y: 5 },
  { x: -5, y: 5 },
];

function area(p: Pt[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const b = p[(i + 1) % p.length];
    a += p[i].x * b.y - b.x * p[i].y;
  }
  return Math.abs(a / 2);
}

describe('offsetClosedPolygon', () => {
  it('grows a square outward by the offset on every side', () => {
    const out = offsetClosedPolygon(CCW_SQUARE, 1);
    expect(out).toHaveLength(4);
    // 10×10 → 12×12.
    expect(area(out)).toBeCloseTo(144, 5);
    expect(Math.min(...out.map((p) => p.x))).toBeCloseTo(-6, 5);
    expect(Math.max(...out.map((p) => p.x))).toBeCloseTo(6, 5);
  });

  it('grows regardless of winding (clockwise input still offsets outward)', () => {
    const cw = [...CCW_SQUARE].reverse();
    const out = offsetClosedPolygon(cw, 1);
    expect(area(out)).toBeGreaterThan(area(cw));
    expect(area(out)).toBeCloseTo(144, 5);
  });

  it('preserves vertex count and 1:1 correspondence', () => {
    const poly: Pt[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 4 },
      { x: 6, y: 4 },
      { x: 6, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(offsetClosedPolygon(poly, 0.5)).toHaveLength(poly.length);
  });

  it('is a no-op for zero offset or degenerate input', () => {
    expect(offsetClosedPolygon(CCW_SQUARE, 0)).toEqual(CCW_SQUARE);
    expect(offsetClosedPolygon([{ x: 1, y: 1 }], 1)).toHaveLength(1);
  });
});
