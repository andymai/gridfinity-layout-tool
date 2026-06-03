import { describe, expect, it } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { applyGroupOp, cutoutToPolygon } from './booleanGeometry';

const baseCutout = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: overrides.id ?? 'c1',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

function polygonArea(ring: readonly [number, number][]): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

function totalArea(result: ReturnType<typeof applyGroupOp>): number {
  if (!result) return 0;
  let area = 0;
  for (const polygon of result) {
    for (let i = 0; i < polygon.length; i++) {
      const ring = polygon[i];
      const a = polygonArea(ring);
      // First ring is outer (positive); subsequent are holes (negative).
      area += i === 0 ? a : -a;
    }
  }
  return area;
}

describe('cutoutToPolygon', () => {
  it('produces a 4-vertex ring for a sharp rectangle', () => {
    const polygon = cutoutToPolygon(baseCutout());
    expect(polygon).not.toBeNull();
    expect(polygon).toHaveLength(1);
    expect(polygon![0]).toHaveLength(4);
  });

  it('inflates a rectangle into many vertices when cornerRadius > 0', () => {
    const polygon = cutoutToPolygon(baseCutout({ cornerRadius: 2 }));
    expect(polygon![0].length).toBeGreaterThan(20);
  });

  it('returns null for zero-area rectangle', () => {
    expect(cutoutToPolygon(baseCutout({ width: 0 }))).toBeNull();
  });

  it('returns null for a path cutout with fewer than two anchors', () => {
    const c = baseCutout({ shape: 'path', path: [] });
    expect(cutoutToPolygon(c)).toBeNull();
  });

  it('produces a 6-vertex ring for a hexagon polygon', () => {
    const polygon = cutoutToPolygon(
      baseCutout({ shape: 'polygon', sides: 6, width: 18, depth: 16 })
    );
    expect(polygon).toHaveLength(1);
    expect(polygon![0]).toHaveLength(6);
  });

  it('honors the polygon side count', () => {
    const tri = cutoutToPolygon(baseCutout({ shape: 'polygon', sides: 3 }));
    expect(tri![0]).toHaveLength(3);
  });

  it('rounds a slot into many vertices (fully-rounded ends)', () => {
    const polygon = cutoutToPolygon(baseCutout({ shape: 'slot', width: 30, depth: 12 }));
    expect(polygon![0].length).toBeGreaterThan(20);
  });

  it('rotates a rectangle around its center', () => {
    const polygon = cutoutToPolygon(baseCutout({ rotation: 45 }))!;
    const xs = polygon[0].map(([x]) => x);
    const ys = polygon[0].map(([, y]) => y);
    // 45° rotation of a 10x10 square centered at (5,5) puts corners at the
    // axes ±5√2 from center → bounds expand to roughly [5 - 5√2, 5 + 5√2].
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(Math.max(...xs)).toBeGreaterThan(10);
    expect(Math.min(...ys)).toBeLessThan(0);
    expect(Math.max(...ys)).toBeGreaterThan(10);
  });
});

describe('applyGroupOp', () => {
  describe('union', () => {
    it('returns one merged polygon when rectangles overlap', () => {
      const a = baseCutout({ id: 'a', x: 0, y: 0, width: 10, depth: 10 });
      const b = baseCutout({ id: 'b', x: 5, y: 5, width: 10, depth: 10 });
      const result = applyGroupOp([a, b], 'union');
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      // Union area = 10*10 + 10*10 − overlap(5x5) = 175
      expect(totalArea(result)).toBeCloseTo(175, 5);
    });

    it('returns two polygons when rectangles are disjoint', () => {
      const a = baseCutout({ id: 'a', x: 0, y: 0 });
      const b = baseCutout({ id: 'b', x: 20, y: 20 });
      const result = applyGroupOp([a, b], 'union')!;
      expect(result).toHaveLength(2);
    });
  });

  describe('intersect', () => {
    it('returns just the overlap region', () => {
      const a = baseCutout({ id: 'a', x: 0, y: 0, width: 10, depth: 10 });
      const b = baseCutout({ id: 'b', x: 5, y: 5, width: 10, depth: 10 });
      const result = applyGroupOp([a, b], 'intersect');
      expect(totalArea(result)).toBeCloseTo(25, 5);
    });

    it('returns null for disjoint rectangles', () => {
      const a = baseCutout({ id: 'a', x: 0, y: 0 });
      const b = baseCutout({ id: 'b', x: 20, y: 20 });
      expect(applyGroupOp([a, b], 'intersect')).toBeNull();
    });
  });

  describe('exclude', () => {
    it('returns union minus intersection (matches XOR for two members)', () => {
      const a = baseCutout({ id: 'a', x: 0, y: 0, width: 10, depth: 10 });
      const b = baseCutout({ id: 'b', x: 5, y: 5, width: 10, depth: 10 });
      // For 2 members union − intersection equals XOR: 175 − 25 = 150
      expect(totalArea(applyGroupOp([a, b], 'exclude'))).toBeCloseTo(150, 5);
    });

    it('keeps regions in some but not all members (diverges from XOR for 3+)', () => {
      // Three identical 10×10 squares laid in a 3×1 chain with 5mm overlap.
      // a covers [0..10] × [0..10], b covers [5..15] × [0..10], c covers [10..20] × [0..10].
      // a ∩ b ∩ c = ∅, so union − intersection = union = 5+5+5+5 = 20 wide × 10 = 200 area? No.
      // Geometry: union spans x∈[0,20] depth=10 → area 200. Intersection = ∅ → result = 200.
      // XOR would also be 200 here (every region is in odd count) — pick a tighter case:
      // Three 10×10 squares stacked so all three meet in a small region.
      const a = baseCutout({ id: 'a', x: 0, y: 0, width: 12, depth: 12 });
      const b = baseCutout({ id: 'b', x: 4, y: 0, width: 12, depth: 12 });
      const c = baseCutout({ id: 'c', x: 2, y: 4, width: 12, depth: 12 });
      // Union − intersection: the small 3-way overlap drops out; everywhere else (including
      // 2-way overlaps) stays. XOR would also strip the 2-way overlaps because they have
      // even count (2 members). Worker computes union − intersection, so this test pins
      // the editor preview to the same semantics.
      const result = applyGroupOp([a, b, c], 'exclude');
      const exclude = totalArea(result);
      const union = totalArea(applyGroupOp([a, b, c], 'union'));
      const intersect = totalArea(applyGroupOp([a, b, c], 'intersect'));
      expect(exclude).toBeCloseTo(union - intersect, 2);
    });
  });

  describe('subtract', () => {
    it('uses the top z-indexed member as the cutter', () => {
      const base = baseCutout({ id: 'base', x: 0, y: 0, width: 10, depth: 10, zIndex: 0 });
      const cutter = baseCutout({ id: 'cutter', x: 5, y: 5, width: 10, depth: 10, zIndex: 1 });
      // base area = 100, cutter overlaps 5x5 = 25 → 100 - 25 = 75
      expect(totalArea(applyGroupOp([base, cutter], 'subtract'))).toBeCloseTo(75, 5);
    });

    it('flips when zIndex flips', () => {
      const a = baseCutout({ id: 'a', x: 0, y: 0, width: 10, depth: 10, zIndex: 1 });
      const b = baseCutout({ id: 'b', x: 5, y: 5, width: 10, depth: 10, zIndex: 0 });
      // top is a (zIndex 1) → result = b - a = 100 - 25 = 75
      expect(totalArea(applyGroupOp([a, b], 'subtract'))).toBeCloseTo(75, 5);
    });

    it('produces a ring with a hole when the cutter is fully inside the base', () => {
      const base = baseCutout({ id: 'base', x: 0, y: 0, width: 20, depth: 20, zIndex: 0 });
      const cutter = baseCutout({ id: 'cutter', x: 5, y: 5, width: 10, depth: 10, zIndex: 1 });
      const result = applyGroupOp([base, cutter], 'subtract')!;
      expect(result).toHaveLength(1);
      // Outer + 1 hole.
      expect(result[0]).toHaveLength(2);
      // 20*20 - 10*10 = 300
      expect(totalArea(result)).toBeCloseTo(300, 5);
    });

    it('returns null when the cutter swallows the base', () => {
      const base = baseCutout({ id: 'base', x: 5, y: 5, width: 5, depth: 5, zIndex: 0 });
      const cutter = baseCutout({ id: 'cutter', x: 0, y: 0, width: 20, depth: 20, zIndex: 1 });
      expect(applyGroupOp([base, cutter], 'subtract')).toBeNull();
    });
  });

  it('skips degenerate members but keeps the rest', () => {
    const a = baseCutout({ id: 'a', x: 0, y: 0 });
    const b = baseCutout({ id: 'b', width: 0 });
    const result = applyGroupOp([a, b], 'union');
    expect(totalArea(result)).toBeCloseTo(100, 5);
  });

  it('returns null when nothing valid remains after filtering degenerate members', () => {
    const a = baseCutout({ id: 'a', width: 0 });
    expect(applyGroupOp([a], 'union')).toBeNull();
  });
});
