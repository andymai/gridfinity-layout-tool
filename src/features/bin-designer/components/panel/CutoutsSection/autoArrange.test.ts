import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { autoArrangeCutouts } from './autoArrange';
import { getCutoutBounds } from './maskFit';

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

    it('packs around a locked shape instead of over it', () => {
      const cutouts = [
        { ...createCutout('pinned', 30, 30), x: 2, y: 2, locked: true },
        createCutout('a', 20, 20),
        createCutout('b', 20, 20),
      ];

      const result = autoArrangeCutouts(cutouts, { binWidth: 100, binDepth: 100, gap: 2 });

      expect(result.pinned).toBeUndefined();
      // Past the locked 30mm square and its 2mm gap, then on along the row.
      expect(result.a).toEqual({ x: 34, y: 2 });
      expect(result.b).toEqual({ x: 56, y: 2 });
    });

    it('drops to the next row when a locked shape blocks the rest of a row', () => {
      const cutouts = [
        { ...createCutout('wall', 80, 30), x: 18, y: 2, locked: true },
        createCutout('a', 20, 20),
      ];

      const result = autoArrangeCutouts(cutouts, { binWidth: 100, binDepth: 100, gap: 2 });

      // No room left of the locked bar (2 + 20 + 2 > 18), none right of it.
      expect(result.a).toEqual({ x: 2, y: 34 });
    });

    it('keeps clear of keep-out floor', () => {
      const cutouts = [createCutout('a', 20, 20)];

      const result = autoArrangeCutouts(cutouts, {
        binWidth: 100,
        binDepth: 100,
        gap: 2,
        keepOut: [{ minX: 0, minY: 0, maxX: 50, maxY: 50 }],
      });

      expect(result.a).toEqual({ x: 52, y: 2 });
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

  describe('turning shapes to fit', () => {
    it('stands portrait shapes on their side so they share one row', () => {
      const cutouts = [createCutout('a', 10, 30), createCutout('b', 10, 30)];
      const result = autoArrangeCutouts(cutouts, {
        binWidth: 70,
        binDepth: 100,
        gap: 2,
        turn: true,
      });
      expect(result.a.rotation).toBe(90);
      expect(result.b.rotation).toBe(90);
      // A rectangle turns about its centre, so its stored box sits 10 mm right
      // of the silhouette and 10 mm below it.
      expect(result.a).toMatchObject({ x: 2 + 10, y: 2 - 10 });
      expect(result.b).toMatchObject({ x: 34 + 10, y: 2 - 10 });
    });

    it('reports no turn for a shape already at its best', () => {
      const result = autoArrangeCutouts([createCutout('a', 30, 10)], {
        binWidth: 70,
        binDepth: 100,
        gap: 2,
        turn: true,
      });
      expect(result.a).toEqual({ x: 2, y: 2 });
    });

    it('moves a group as one block without turning it', () => {
      const members = [
        { ...createCutout('m1', 10, 30), groupId: 'g' },
        { ...createCutout('m2', 10, 30), x: 15, groupId: 'g' },
      ];
      const result = autoArrangeCutouts(members, {
        binWidth: 100,
        binDepth: 100,
        gap: 2,
        turn: true,
      });
      expect(result.m1).toEqual({ x: 2, y: 2 });
      expect(result.m2).toEqual({ x: 17, y: 2 });
    });

    it('lands turned shapes in the same places when arranged again', () => {
      const corner = (x: number, y: number) => ({
        x,
        y,
        handleIn: null,
        handleOut: null,
        symmetric: false,
      });
      const bar = (id: string, deg: number, at: { x: number; y: number } = { x: 30, y: 10 }) => {
        const a = (deg * Math.PI) / 180;
        const pts = [
          [0, 0],
          [40, 0],
          [40, 8],
          [0, 8],
        ].map(([x, y]) => ({
          x: at.x + x * Math.cos(a) - y * Math.sin(a),
          y: at.y + x * Math.sin(a) + y * Math.cos(a),
        }));
        const xs = pts.map((q) => q.x);
        const ys = pts.map((q) => q.y);
        return {
          ...createCutout(id, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)),
          shape: 'path' as const,
          x: Math.min(...xs),
          y: Math.min(...ys),
          path: pts.map((q) => corner(q.x, q.y)),
        };
      };
      const bars = [bar('a', 35), bar('b', -50, { x: 80, y: 40 }), bar('c', 70, { x: 60, y: 60 })];
      const options = { binWidth: 120, binDepth: 100, gap: 2, turn: true };
      const once = autoArrangeCutouts(bars, options);
      const moved = bars.map((c): Cutout => {
        const at = once[c.id];
        const dx = at.x - c.x;
        const dy = at.y - c.y;
        return {
          ...c,
          ...at,
          path: (c.path ?? []).map((q) => ({ ...q, x: q.x + dx, y: q.y + dy })),
        };
      });
      const twice = autoArrangeCutouts(moved, options);
      for (const { id } of bars) {
        expect(twice[id].x).toBeCloseTo(once[id].x, 6);
        expect(twice[id].y).toBeCloseTo(once[id].y, 6);
        expect(twice[id].rotation).toBeUndefined();
      }
    });

    it('keeps a container holding one shape as a block, and turns that shape inside it', () => {
      const alone = { ...createCutout('a', 10, 30), parentGroups: ['box'] };
      const options = { binWidth: 70, binDepth: 100, gap: 2, turn: true };
      expect(autoArrangeCutouts([alone], options).a.rotation).toBeUndefined();
      expect(autoArrangeCutouts([alone], options, ['box']).a.rotation).toBe(90);
    });

    it('stands a long shape along the depth of a bin too narrow to lay it across', () => {
      const result = autoArrangeCutouts([createCutout('a', 10, 80), createCutout('b', 10, 80)], {
        binWidth: 40,
        binDepth: 100,
        gap: 2,
        turn: true,
      });
      expect(result.a).toEqual({ x: 2, y: 2 });
      expect(result.b).toEqual({ x: 14, y: 2 });
    });

    it('turns a shape lying across a narrow bin to stand along it', () => {
      const result = autoArrangeCutouts([createCutout('a', 80, 10)], {
        binWidth: 40,
        binDepth: 100,
        gap: 2,
        turn: true,
      });
      expect(result.a.rotation).toBe(90);
    });

    it('keeps the angle of a shape that fits as drawn but in neither square turn', () => {
      const bar = { ...createCutout('a', 80, 10), x: 0, y: 0, rotation: 45 };
      const result = autoArrangeCutouts([bar], { binWidth: 70, binDepth: 70, gap: 2, turn: true });
      expect(result.a.rotation).toBeUndefined();
      const b = getCutoutBounds({ ...bar, ...result.a });
      expect(b.minX).toBeCloseTo(2, 6);
      expect(b.minY).toBeCloseTo(2, 6);
    });

    it('places a kept angle by its own outline, not the half turn it was measured at', () => {
      const a = (35 * Math.PI) / 180;
      const pts = [
        [0, 0],
        [80, 0],
        [60, 10],
        [0, 10],
      ].map(([x, y]) => ({
        x: 30 + x * Math.cos(a) - y * Math.sin(a),
        y: 20 + x * Math.sin(a) + y * Math.cos(a),
      }));
      const xs = pts.map((q) => q.x);
      const ys = pts.map((q) => q.y);
      const trapezoid: Cutout = {
        ...createCutout('a', Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)),
        shape: 'path',
        x: Math.min(...xs),
        y: Math.min(...ys),
        rotation: 305,
        path: pts.map((q) => ({ ...q, handleIn: null, handleOut: null, symmetric: false })),
      };
      const result = autoArrangeCutouts([trapezoid], {
        binWidth: 40,
        binDepth: 100,
        gap: 2,
        turn: true,
      });
      expect(result.a.rotation).toBeUndefined();
      const dx = result.a.x - trapezoid.x;
      const dy = result.a.y - trapezoid.y;
      const placed = {
        ...trapezoid,
        ...result.a,
        path: (trapezoid.path ?? []).map((q) => ({ ...q, x: q.x + dx, y: q.y + dy })),
      };
      const b = getCutoutBounds(placed);
      expect(b.minX).toBeCloseTo(2, 6);
      expect(b.minY).toBeCloseTo(2, 6);
    });

    it('stores a turn as the editor keeps angles, from 0° up to 360°', () => {
      const a = (-50 * Math.PI) / 180;
      const pts = [
        [0, 0],
        [40, 0],
        [40, 8],
        [0, 8],
      ].map(([x, y]) => ({
        x: 20 + x * Math.cos(a) - y * Math.sin(a),
        y: 60 + x * Math.sin(a) + y * Math.cos(a),
      }));
      const xs = pts.map((q) => q.x);
      const ys = pts.map((q) => q.y);
      const bar: Cutout = {
        ...createCutout('a', Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)),
        shape: 'path',
        x: Math.min(...xs),
        y: Math.min(...ys),
        path: pts.map((q) => ({ ...q, handleIn: null, handleOut: null, symmetric: false })),
      };
      const result = autoArrangeCutouts([bar], { binWidth: 70, binDepth: 100, gap: 2, turn: true });
      expect(result.a.rotation).toBeCloseTo(310, 6);
    });

    it('turns nothing unless asked', () => {
      const result = autoArrangeCutouts([createCutout('a', 10, 30)], {
        binWidth: 70,
        binDepth: 100,
        gap: 2,
      });
      expect(result.a).toEqual({ x: 2, y: 2 });
    });
  });
});
