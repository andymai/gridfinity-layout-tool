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
});
