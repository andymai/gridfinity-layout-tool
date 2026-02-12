import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { collectSnapTargets, snapToNearestTarget, computeMeasurement } from './rulerHandler';

function makeCutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'test-1',
    shape: 'rectangle',
    x: 10,
    y: 20,
    width: 30,
    depth: 20,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

describe('collectSnapTargets', () => {
  it('returns corners, edge midpoints, and center for a rectangle', () => {
    const cutout = makeCutout({ x: 0, y: 0, width: 10, depth: 20 });
    const targets = collectSnapTargets([cutout]);

    // 4 corners + 4 edge midpoints + 1 center = 9
    expect(targets).toHaveLength(9);

    // Corners
    expect(targets).toContainEqual({ x: 0, y: 0 });
    expect(targets).toContainEqual({ x: 10, y: 0 });
    expect(targets).toContainEqual({ x: 0, y: 20 });
    expect(targets).toContainEqual({ x: 10, y: 20 });

    // Center
    expect(targets).toContainEqual({ x: 5, y: 10 });
  });

  it('skips hidden cutouts', () => {
    const cutout = makeCutout({ hidden: true });
    const targets = collectSnapTargets([cutout]);
    expect(targets).toHaveLength(0);
  });
});

describe('snapToNearestTarget', () => {
  const targets = [
    { x: 10, y: 10 },
    { x: 50, y: 50 },
  ];

  it('snaps to nearest target within threshold', () => {
    // At zoom=1, threshold is 8mm. Point (11, 11) is ~1.4mm from (10,10)
    const result = snapToNearestTarget(11, 11, targets, 1);
    expect(result.snapped).toBe(true);
    expect(result.x).toBe(10);
    expect(result.y).toBe(10);
  });

  it('returns original point when nothing is close enough', () => {
    const result = snapToNearestTarget(30, 30, targets, 1);
    expect(result.snapped).toBe(false);
    expect(result.x).toBe(30);
    expect(result.y).toBe(30);
  });

  it('adapts threshold based on zoom', () => {
    // At zoom=10, threshold is 0.8mm. Point (11, 10) is 1mm away — too far
    const result = snapToNearestTarget(11, 10, targets, 10);
    expect(result.snapped).toBe(false);
  });
});

describe('computeMeasurement', () => {
  it('computes distance and deltas for horizontal line', () => {
    const result = computeMeasurement(0, 0, 10, 0);
    expect(result.distance).toBeCloseTo(10);
    expect(result.deltaX).toBe(10);
    expect(result.deltaY).toBe(0);
  });

  it('computes distance for diagonal line', () => {
    const result = computeMeasurement(0, 0, 3, 4);
    expect(result.distance).toBeCloseTo(5);
    expect(result.deltaX).toBe(3);
    expect(result.deltaY).toBe(4);
  });

  it('handles zero-length measurement', () => {
    const result = computeMeasurement(5, 5, 5, 5);
    expect(result.distance).toBe(0);
  });
});
