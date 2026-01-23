import { describe, it, expect } from 'vitest';
import { getRotatedDimensions, computeSnapGuides } from '../../components/parameters/InsertFloorPlan';
import type { Insert } from '../../types';

function makeInsert(overrides: Partial<Insert> = {}): Insert {
  return {
    id: 'test-1',
    templateId: null,
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    depth: 5,
    cutDepth: 3,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    ...overrides,
  };
}

describe('getRotatedDimensions', () => {
  it('returns original dimensions at 0 degrees', () => {
    const insert = makeInsert({ width: 10, depth: 5, rotation: 0 });
    expect(getRotatedDimensions(insert)).toEqual({ width: 10, depth: 5 });
  });

  it('returns original dimensions at 180 degrees', () => {
    const insert = makeInsert({ width: 10, depth: 5, rotation: 180 });
    expect(getRotatedDimensions(insert)).toEqual({ width: 10, depth: 5 });
  });

  it('swaps dimensions at 90 degrees', () => {
    const insert = makeInsert({ width: 10, depth: 5, rotation: 90 });
    expect(getRotatedDimensions(insert)).toEqual({ width: 5, depth: 10 });
  });

  it('swaps dimensions at 270 degrees', () => {
    const insert = makeInsert({ width: 10, depth: 5, rotation: 270 });
    expect(getRotatedDimensions(insert)).toEqual({ width: 5, depth: 10 });
  });

  it('works with square inserts (no effective change)', () => {
    const insert = makeInsert({ width: 8, depth: 8, rotation: 90 });
    expect(getRotatedDimensions(insert)).toEqual({ width: 8, depth: 8 });
  });
});

describe('computeSnapGuides', () => {
  it('returns no guides when no other inserts exist', () => {
    const drag = [makeInsert({ x: 5, y: 5 })];
    const result = computeSnapGuides(drag, [], { dx: 1, dy: 1 }, 2);
    expect(result.guides).toEqual([]);
    expect(result.snapDx).toBe(0);
    expect(result.snapDy).toBe(0);
  });

  it('snaps left edge to left edge of another insert', () => {
    const drag = [makeInsert({ id: 'a', x: 5, y: 0, width: 10, depth: 5 })];
    const other = [makeInsert({ id: 'b', x: 20, y: 10, width: 10, depth: 5 })];
    // Moving drag insert so its left edge (5 + dx) approaches 20
    const result = computeSnapGuides(drag, other, { dx: 14.5, dy: 0 }, 2);
    // Should snap: 5 + 14.5 = 19.5, target = 20, diff = 0.5 < threshold
    expect(result.snapDx).toBeCloseTo(0.5);
  });

  it('snaps right edge to left edge of another insert', () => {
    const drag = [makeInsert({ id: 'a', x: 0, y: 0, width: 10, depth: 5 })];
    const other = [makeInsert({ id: 'b', x: 20, y: 10, width: 10, depth: 5 })];
    // Moving so right edge (0 + 10 + dx) approaches 20
    const result = computeSnapGuides(drag, other, { dx: 9.5, dy: 0 }, 2);
    // right edge at 0 + 10 + 9.5 = 19.5, target = 20, snap = 0.5
    expect(result.snapDx).toBeCloseTo(0.5);
  });

  it('snaps center to center of another insert (X)', () => {
    const drag = [makeInsert({ id: 'a', x: 0, y: 0, width: 10, depth: 5 })];
    const other = [makeInsert({ id: 'b', x: 20, y: 10, width: 10, depth: 5 })];
    // Other center x = 20 + 5 = 25. Drag center = 0 + 5 + dx.
    // To approach: dx = 19.5 → center = 24.5, dist to 25 = 0.5
    const result = computeSnapGuides(drag, other, { dx: 19.5, dy: 0 }, 2);
    expect(result.snapDx).toBeCloseTo(0.5);
  });

  it('snaps Y axis (top edge to top edge)', () => {
    const drag = [makeInsert({ id: 'a', x: 0, y: 0, width: 10, depth: 5 })];
    const other = [makeInsert({ id: 'b', x: 20, y: 15, width: 10, depth: 5 })];
    // Drag bottom y = 0 + dy = 14.5, target = 15 (other bottom y)
    const result = computeSnapGuides(drag, other, { dx: 0, dy: 14.5 }, 2);
    expect(result.snapDy).toBeCloseTo(0.5);
  });

  it('does not snap when distance exceeds threshold', () => {
    const drag = [makeInsert({ id: 'a', x: 0, y: 0, width: 10, depth: 5 })];
    const other = [makeInsert({ id: 'b', x: 30, y: 30, width: 10, depth: 5 })];
    // Far apart — no snap
    const result = computeSnapGuides(drag, other, { dx: 5, dy: 5 }, 2);
    expect(result.snapDx).toBe(0);
    expect(result.snapDy).toBe(0);
    expect(result.guides).toEqual([]);
  });

  it('generates vertical guide when X snaps', () => {
    const drag = [makeInsert({ id: 'a', x: 5, y: 0, width: 10, depth: 5 })];
    const other = [makeInsert({ id: 'b', x: 20, y: 10, width: 10, depth: 5 })];
    const result = computeSnapGuides(drag, other, { dx: 14.5, dy: 0 }, 2);
    expect(result.guides.length).toBeGreaterThan(0);
    expect(result.guides.some((g) => g.orientation === 'vertical')).toBe(true);
  });

  it('generates horizontal guide when Y snaps', () => {
    const drag = [makeInsert({ id: 'a', x: 0, y: 0, width: 10, depth: 5 })];
    const other = [makeInsert({ id: 'b', x: 0, y: 15, width: 10, depth: 5 })];
    const result = computeSnapGuides(drag, other, { dx: 0, dy: 14.5 }, 2);
    expect(result.guides.length).toBeGreaterThan(0);
    expect(result.guides.some((g) => g.orientation === 'horizontal')).toBe(true);
  });

  it('considers rotated dimensions for snap targets', () => {
    // Other insert is 10x5 at x=20, but rotated 90° → effective width=5
    const drag = [makeInsert({ id: 'a', x: 0, y: 0, width: 10, depth: 5 })];
    const other = [makeInsert({ id: 'b', x: 20, y: 10, width: 10, depth: 5, rotation: 90 })];
    // Other right edge = 20 + 5 = 25 (rotated width)
    // Drag right edge = 10 + dx. To snap to 25: dx = 14.5 → edge at 24.5, snap 0.5
    const result = computeSnapGuides(drag, other, { dx: 14.5, dy: 0 }, 2);
    expect(result.snapDx).toBeCloseTo(0.5);
  });

  it('handles multiple drag inserts', () => {
    const drag = [
      makeInsert({ id: 'a', x: 0, y: 0, width: 10, depth: 5 }),
      makeInsert({ id: 'b', x: 0, y: 10, width: 10, depth: 5 }),
    ];
    const other = [makeInsert({ id: 'c', x: 20, y: 0, width: 10, depth: 5 })];
    // Both inserts' left edges at 0 + dx = 19.5, target = 20
    const result = computeSnapGuides(drag, other, { dx: 19.5, dy: 0 }, 2);
    expect(result.snapDx).toBeCloseTo(0.5);
  });

  it('picks the closest snap target', () => {
    const drag = [makeInsert({ id: 'a', x: 0, y: 0, width: 10, depth: 5 })];
    const other = [
      makeInsert({ id: 'b', x: 15, y: 0, width: 5, depth: 5 }), // left edge at 15
      makeInsert({ id: 'c', x: 15.2, y: 10, width: 5, depth: 5 }), // left edge at 15.2
    ];
    // Moving right edge (10 + dx) toward 15.
    // dx = 4.8: right edge = 14.8, dist to 15 = 0.2, dist to 15.2 = 0.4
    const result = computeSnapGuides(drag, other, { dx: 4.8, dy: 0 }, 2);
    // Should snap to closest: 15. snapDx = 15 - 14.8 = 0.2
    expect(result.snapDx).toBeCloseTo(0.2);
  });
});
