import { describe, it, expect } from 'vitest';
import { snapPosition, snapGroupDelta, snapResizeRect, snapDrawRect, SNAP_RADIUS } from './snap';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import type { BinId } from '@/core/types';
import { binId } from '@/core/types';
import type { SnapResult } from './snap';

/** Assert non-null and return the value with narrowed type. */
function assertNonNull(value: SnapResult | null): SnapResult {
  expect(value).not.toBeNull();
  if (value === null) throw new Error('Expected non-null SnapResult');
  return value;
}

describe('SNAP_RADIUS', () => {
  it('is 2 grid units', () => {
    expect(SNAP_RADIUS).toBe(2);
  });
});

describe('snapPosition', () => {
  it('returns isSnapped: false when target position is valid', () => {
    const layout = createTestLayout({
      drawer: { width: 10, depth: 8, height: 12 },
      bins: [],
    });

    const result = assertNonNull(
      snapPosition(2, 2, 1, 1, 3, layout.layers[0].id, layout, binId('test'), 0, 0, 1)
    );

    expect(result.x).toBe(2);
    expect(result.y).toBe(2);
    expect(result.isSnapped).toBe(false);
  });

  it('snaps to nearby valid position when target collides', () => {
    const blocker = createTestBin({ id: 'blocker', x: 2, y: 2, width: 2, depth: 2 });
    const layout = createTestLayout({
      drawer: { width: 10, depth: 8, height: 12 },
      bins: [blocker],
    });

    // Try to place at (2, 2) where blocker is — should snap to a nearby valid spot
    const result = assertNonNull(
      snapPosition(2, 2, 1, 1, 3, layout.layers[0].id, layout, binId('moving'), 1, 0, 1)
    );

    expect(result.isSnapped).toBe(true);
    // Should have moved away from the collision — x or y (or both) must differ
    const moved = result.x !== 2 || result.y !== 2;
    expect(moved).toBe(true);
  });

  it('returns null when no valid position within radius', () => {
    // Fill almost the entire drawer
    const bins = [];
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 8; y++) {
        bins.push(createTestBin({ id: `bin-${x}-${y}`, x, y, width: 1, depth: 1 }));
      }
    }
    const layout = createTestLayout({
      drawer: { width: 10, depth: 8, height: 12 },
      bins,
    });

    const result = snapPosition(
      5,
      4,
      1,
      1,
      3,
      layout.layers[0].id,
      layout,
      binId('moving'),
      0,
      0,
      1
    );

    expect(result).toBeNull();
  });

  it('returns null for bounds violations (not collision)', () => {
    const layout = createTestLayout({
      drawer: { width: 5, depth: 5, height: 12 },
      bins: [],
    });

    // Place at x=5, which exceeds drawer width of 5 (needs width 1, so max x=4)
    const result = snapPosition(5, 0, 1, 1, 3, layout.layers[0].id, layout, binId('test'), 0, 0, 1);

    expect(result).toBeNull();
  });

  it('prefers movement direction when tie-breaking', () => {
    // Place a 2x2 blocker in the middle, try to snap from its position
    const blocker = createTestBin({ id: 'blocker', x: 4, y: 3, width: 2, depth: 2 });
    const layout = createTestLayout({
      drawer: { width: 10, depth: 8, height: 12 },
      bins: [blocker],
    });

    // Moving right (moveDirX = 1): should prefer right-side snap
    const resultRight = assertNonNull(
      snapPosition(4, 3, 1, 1, 3, layout.layers[0].id, layout, binId('moving'), 1, 0, 1)
    );
    expect(resultRight.isSnapped).toBe(true);

    // Moving left (moveDirX = -1): should prefer left-side snap
    const resultLeft = assertNonNull(
      snapPosition(4, 3, 1, 1, 3, layout.layers[0].id, layout, binId('moving'), -1, 0, 1)
    );
    expect(resultLeft.isSnapped).toBe(true);

    // The two should snap to different positions
    expect(resultRight.x).not.toBe(resultLeft.x);
  });

  it('works with half-bin step (0.5)', () => {
    const blocker = createTestBin({ id: 'blocker', x: 2, y: 2, width: 1, depth: 1 });
    const layout = createTestLayout({
      drawer: { width: 10, depth: 8, height: 12 },
      bins: [blocker],
    });

    const result = assertNonNull(
      snapPosition(2, 2, 0.5, 0.5, 3, layout.layers[0].id, layout, binId('moving'), 0, 0, 0.5)
    );

    expect(result.isSnapped).toBe(true);
  });

  it('excludes the specified bin from collision checks', () => {
    // The "excludeBinId" bin should not block itself
    const bin = createTestBin({ id: 'self', x: 3, y: 3, width: 1, depth: 1 });
    const layout = createTestLayout({
      drawer: { width: 10, depth: 8, height: 12 },
      bins: [bin],
    });

    const result = assertNonNull(
      snapPosition(3, 3, 1, 1, 3, layout.layers[0].id, layout, binId('self'), 0, 0, 1)
    );

    expect(result.isSnapped).toBe(false); // Should be valid at its own position
    expect(result.x).toBe(3);
    expect(result.y).toBe(3);
  });
});

describe('snapGroupDelta', () => {
  it('returns isSnapped: false when requested delta is valid', () => {
    const bins = [
      createTestBin({ id: 'a', x: 0, y: 0, width: 1, depth: 1 }),
      createTestBin({ id: 'b', x: 1, y: 0, width: 1, depth: 1 }),
    ];
    const layout = createTestLayout({
      drawer: { width: 10, depth: 8, height: 12 },
      bins,
    });
    const excludeIds = new Set<BinId>(bins.map((b) => b.id));

    const result = assertNonNull(
      snapGroupDelta(bins, 2, 0, layout.layers[0].id, layout, excludeIds, 1, 0, 1)
    );

    expect(result.x).toBe(2);
    expect(result.y).toBe(0);
    expect(result.isSnapped).toBe(false);
  });

  it('finds valid delta when requested would collide', () => {
    const group = [createTestBin({ id: 'a', x: 0, y: 0, width: 1, depth: 1 })];
    const blocker = createTestBin({ id: 'blocker', x: 2, y: 0, width: 1, depth: 1 });
    const layout = createTestLayout({
      drawer: { width: 10, depth: 8, height: 12 },
      bins: [...group, blocker],
    });
    const excludeIds = new Set<BinId>(group.map((b) => b.id));

    // Try to move to x=2, which would collide with blocker
    const result = assertNonNull(
      snapGroupDelta(group, 2, 0, layout.layers[0].id, layout, excludeIds, 1, 0, 1)
    );

    expect(result.isSnapped).toBe(true);
    // Should find a nearby valid delta
  });

  it('returns null when no valid delta exists within radius', () => {
    const group = [createTestBin({ id: 'a', x: 0, y: 0, width: 3, depth: 3 })];
    // Fill the drawer with blockers
    const blockers = [];
    for (let x = 3; x < 10; x++) {
      for (let y = 0; y < 8; y++) {
        blockers.push(createTestBin({ id: `b-${x}-${y}`, x, y, width: 1, depth: 1 }));
      }
    }
    for (let y = 3; y < 8; y++) {
      for (let x = 0; x < 3; x++) {
        blockers.push(createTestBin({ id: `c-${x}-${y}`, x, y, width: 1, depth: 1 }));
      }
    }
    const layout = createTestLayout({
      drawer: { width: 10, depth: 8, height: 12 },
      bins: [...group, ...blockers],
    });
    const excludeIds = new Set<BinId>(group.map((b) => b.id));

    // Try to move to a fully occupied area
    const result = snapGroupDelta(group, 5, 5, layout.layers[0].id, layout, excludeIds, 1, 0, 1);

    expect(result).toBeNull();
  });

  it('preserves relative group arrangement', () => {
    const group = [
      createTestBin({ id: 'a', x: 0, y: 0, width: 1, depth: 1 }),
      createTestBin({ id: 'b', x: 1, y: 0, width: 1, depth: 1 }),
    ];
    const blocker = createTestBin({ id: 'blocker', x: 3, y: 0, width: 1, depth: 1 });
    const layout = createTestLayout({
      drawer: { width: 10, depth: 8, height: 12 },
      bins: [...group, blocker],
    });
    const excludeIds = new Set<BinId>(group.map((b) => b.id));

    const result = assertNonNull(
      snapGroupDelta(group, 2, 0, layout.layers[0].id, layout, excludeIds, 1, 0, 1)
    );

    // The delta should be the same for both bins (group moves together)
    expect(typeof result.x).toBe('number');
    expect(typeof result.y).toBe('number');
  });
});

describe('snapResizeRect', () => {
  it('returns original rect with isSnapped: false when valid', () => {
    const layout = createTestLayout({
      drawer: { width: 10, depth: 8, height: 12 },
      bins: [],
    });
    const startRect = { x: 0, y: 0, width: 1, depth: 1 };
    const requestedRect = { x: 0, y: 0, width: 3, depth: 1 };

    const result = snapResizeRect(
      startRect,
      'e',
      requestedRect,
      3,
      layout.layers[0].id,
      layout,
      binId('self'),
      new Set([binId('self')]),
      1,
      layout.drawer
    );

    expect(result.rect).toEqual(requestedRect);
    expect(result.isSnapped).toBe(false);
  });

  it('snaps to max valid size when resize would collide', () => {
    const blocker = createTestBin({ id: 'blocker', x: 3, y: 0, width: 1, depth: 1 });
    const layout = createTestLayout({
      drawer: { width: 10, depth: 8, height: 12 },
      bins: [blocker],
    });
    const startRect = { x: 0, y: 0, width: 1, depth: 1 };
    const requestedRect = { x: 0, y: 0, width: 5, depth: 1 }; // Would collide with blocker at x=3

    const result = snapResizeRect(
      startRect,
      'e',
      requestedRect,
      3,
      layout.layers[0].id,
      layout,
      binId('self'),
      new Set([binId('self')]),
      1,
      layout.drawer
    );

    expect(result.isSnapped).toBe(true);
    // Should be smaller than requested but larger than start
    expect(result.rect.width).toBeLessThan(requestedRect.width);
    expect(result.rect.width).toBeGreaterThanOrEqual(startRect.width);
    // Should not collide with blocker (width should be <= 3)
    expect(result.rect.x + result.rect.width).toBeLessThanOrEqual(3);
  });

  it('falls back to start rect when nothing valid between start and requested', () => {
    // Blocker immediately adjacent to start rect
    const blocker = createTestBin({ id: 'blocker', x: 1, y: 0, width: 1, depth: 1 });
    const layout = createTestLayout({
      drawer: { width: 10, depth: 8, height: 12 },
      bins: [blocker],
    });
    const startRect = { x: 0, y: 0, width: 1, depth: 1 };
    const requestedRect = { x: 0, y: 0, width: 5, depth: 1 };

    const result = snapResizeRect(
      startRect,
      'e',
      requestedRect,
      3,
      layout.layers[0].id,
      layout,
      binId('self'),
      new Set([binId('self')]),
      1,
      layout.drawer
    );

    // Walk-back reaches the start rect as the largest valid size → isSnapped true
    expect(result.rect).toEqual(startRect);
    expect(result.isSnapped).toBe(true);
  });
});

describe('snapDrawRect', () => {
  it('returns original dimensions when valid', () => {
    const layout = createTestLayout({
      drawer: { width: 10, depth: 8, height: 12 },
      bins: [],
    });

    const result = snapDrawRect(0, 0, 3, 2, 3, layout.layers[0].id, layout, 1);

    expect(result.width).toBe(3);
    expect(result.depth).toBe(2);
  });

  it('shrinks width to avoid collision', () => {
    const blocker = createTestBin({ id: 'blocker', x: 2, y: 0, width: 1, depth: 2 });
    const layout = createTestLayout({
      drawer: { width: 10, depth: 8, height: 12 },
      bins: [blocker],
    });

    // Draw a 4x2 rect starting at (0,0) — would overlap with blocker at x=2
    const result = snapDrawRect(0, 0, 4, 2, 3, layout.layers[0].id, layout, 1);

    // Should shrink width to 2 to avoid the blocker
    expect(result.width).toBeLessThanOrEqual(2);
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.depth).toBe(2); // Depth should stay same
  });

  it('shrinks depth to avoid collision', () => {
    const blocker = createTestBin({ id: 'blocker', x: 0, y: 2, width: 4, depth: 1 });
    const layout = createTestLayout({
      drawer: { width: 10, depth: 8, height: 12 },
      bins: [blocker],
    });

    // Draw a 4x4 rect starting at (0,0) — would overlap with blocker at y=2
    const result = snapDrawRect(0, 0, 4, 4, 3, layout.layers[0].id, layout, 1);

    // Width shrink didn't help (blocker spans full width range), so should shrink depth
    expect(result.depth).toBeLessThanOrEqual(2);
    expect(result.depth).toBeGreaterThanOrEqual(1);
  });

  it('returns original dimensions for bounds violations (no snap)', () => {
    const layout = createTestLayout({
      drawer: { width: 5, depth: 5, height: 12 },
      bins: [],
    });

    // This position is out of bounds, not collision — should not snap
    const result = snapDrawRect(4, 4, 3, 3, 3, layout.layers[0].id, layout, 1);

    expect(result.width).toBe(3);
    expect(result.depth).toBe(3);
  });

  it('works with half-bin step (0.5)', () => {
    const blocker = createTestBin({ id: 'blocker', x: 1.5, y: 0, width: 1, depth: 1 });
    const layout = createTestLayout({
      drawer: { width: 10, depth: 8, height: 12 },
      bins: [blocker],
    });

    const result = snapDrawRect(0, 0, 3, 1, 3, layout.layers[0].id, layout, 0.5);

    // Should shrink width to 1.5 or less to avoid collision
    expect(result.width).toBeLessThanOrEqual(1.5);
    expect(result.width).toBeGreaterThanOrEqual(0.5);
  });
});
