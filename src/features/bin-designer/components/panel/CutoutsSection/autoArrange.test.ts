import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { autoArrangeCutouts } from './autoArrange';

const createCutout = (id: string, width: number, depth: number): Cutout => ({
  id,
  shape: 'rectangle',
  x: 0,
  y: 0,
  width,
  depth,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
});

describe('autoArrangeCutouts', () => {
  it('arranges cutouts left-to-right in a single row', () => {
    const cutouts = [createCutout('a', 10, 10), createCutout('b', 10, 10)];

    const result = autoArrangeCutouts(cutouts, { binWidth: 100, binDepth: 100, gap: 2 });

    expect(result.a).toEqual({ x: 2, y: 2 });
    // sorted by depth desc, both same depth so order preserved
  });

  it('wraps to new row when cutout exceeds bin width', () => {
    const cutouts = [
      createCutout('a', 30, 10),
      createCutout('b', 30, 10),
      createCutout('c', 30, 10),
    ];

    const result = autoArrangeCutouts(cutouts, { binWidth: 70, binDepth: 100, gap: 2 });

    // First row: a at (2, 2), b at (34, 2)
    expect(result.a.x).toBe(2);
    expect(result.a.y).toBe(2);
    expect(result.b.x).toBe(34);
    expect(result.b.y).toBe(2);
    // Third cutout wraps to next row
    expect(result.c.x).toBe(2);
    expect(result.c.y).toBe(14); // 2 + 10 + 2
  });

  it('sorts by depth descending (tallest first)', () => {
    const cutouts = [createCutout('small', 10, 5), createCutout('tall', 10, 20)];

    const result = autoArrangeCutouts(cutouts, { binWidth: 100, binDepth: 100, gap: 2 });

    // 'tall' should be placed first (depth 20 > depth 5)
    expect(result.tall.x).toBe(2);
    expect(result.tall.y).toBe(2);
    expect(result.small.x).toBe(14);
    expect(result.small.y).toBe(2);
  });

  it('handles empty array', () => {
    const result = autoArrangeCutouts([], { binWidth: 100, binDepth: 100, gap: 2 });
    expect(result).toEqual({});
  });

  it('respects gap parameter', () => {
    const cutouts = [createCutout('a', 10, 10), createCutout('b', 10, 10)];

    const result = autoArrangeCutouts(cutouts, { binWidth: 100, binDepth: 100, gap: 5 });

    expect(result.a).toEqual({ x: 5, y: 5 });
    expect(result.b).toEqual({ x: 20, y: 5 }); // 5 + 10 + 5
  });

  describe('groups (#3468)', () => {
    const grouped = (id: string, groupId: string, at: Partial<Cutout>): Cutout => ({
      ...createCutout(id, 10, 10),
      groupId,
      ...at,
    });

    it('packs a group as one unit and keeps its members rigid', () => {
      // Two shapes 30mm apart, grouped — the pair must stay 30mm apart.
      const cutouts = [grouped('a', 'g1', { x: 50, y: 50 }), grouped('b', 'g1', { x: 80, y: 50 })];

      const result = autoArrangeCutouts(cutouts, { binWidth: 100, binDepth: 100, gap: 2 });

      expect(result.b.x - result.a.x).toBe(30);
      expect(result.b.y - result.a.y).toBe(0);
      // The unit's own bounding box lands at the shelf origin.
      expect(result.a).toEqual({ x: 2, y: 2 });
    });

    it('lays two duplicated groups side by side without interleaving them', () => {
      // The reported repro: build a shape from two parts, group it, duplicate
      // the group, select everything, auto-arrange.
      const cutouts = [
        grouped('a1', 'g1', { x: 0, y: 0 }),
        grouped('a2', 'g1', { x: 12, y: 0 }),
        grouped('b1', 'g2', { x: 0, y: 40 }),
        grouped('b2', 'g2', { x: 12, y: 40 }),
      ];

      const result = autoArrangeCutouts(cutouts, { binWidth: 100, binDepth: 100, gap: 2 });

      // Each group keeps its internal offset...
      expect(result.a2.x - result.a1.x).toBe(12);
      expect(result.b2.x - result.b1.x).toBe(12);
      // ...and the two groups occupy disjoint spans rather than being shuffled.
      const groupAEnd = result.a2.x + 10;
      expect(result.b1.x).toBeGreaterThanOrEqual(groupAEnd);
    });

    it('measures a group by its combined footprint when wrapping rows', () => {
      // A 42mm-wide group cannot share a 50mm row with a 20mm shape.
      const cutouts = [
        grouped('g-left', 'g1', { x: 0, y: 0, width: 20, depth: 10 }),
        grouped('g-right', 'g1', { x: 22, y: 0, width: 20, depth: 10 }),
        { ...createCutout('solo', 20, 10) },
      ];

      const result = autoArrangeCutouts(cutouts, { binWidth: 50, binDepth: 100, gap: 2 });

      expect(result['g-left']).toEqual({ x: 2, y: 2 });
      expect(result['g-right']).toEqual({ x: 24, y: 2 });
      expect(result.solo.y).toBe(14); // wrapped: 2 + 10 + 2
    });

    it('leaves a group containing a locked member where it is', () => {
      const cutouts = [
        grouped('a', 'g1', { x: 60, y: 60 }),
        grouped('b', 'g1', { x: 72, y: 60, locked: true }),
        { ...createCutout('solo', 10, 10), x: 90, y: 90 },
      ];

      const result = autoArrangeCutouts(cutouts, { binWidth: 100, binDepth: 100, gap: 2 });

      expect(result.a).toBeUndefined();
      expect(result.b).toBeUndefined();
      expect(result.solo).toEqual({ x: 2, y: 2 });
    });

    it('claims the rotated footprint of a shape, not its unrotated box', () => {
      const cutouts = [
        { ...createCutout('turned', 30, 10), rotation: 90 },
        createCutout('next', 10, 10),
      ];

      const result = autoArrangeCutouts(cutouts, { binWidth: 100, binDepth: 100, gap: 2 });

      // Turned 90°, the 30x10 shape is 10 wide — 'next' starts at 2 + 10 + 2.
      expect(result.next.x).toBeCloseTo(14);
    });
  });
});
