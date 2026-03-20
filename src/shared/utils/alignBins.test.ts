import { describe, it, expect } from 'vitest';
import { computeAlignedPositions } from './alignBins';
import type { AlignEdge } from './alignBins';
import { createTestLayout, createTestBin } from '@/test/testUtils';
import { binId, layerId } from '@/core/types';
import { STAGING_ID } from '@/core/constants';

function makeBins(...defs: Array<{ id: string; x: number; y: number; w: number; d: number }>) {
  return defs.map((d) =>
    createTestBin({ id: binId(d.id), x: d.x, y: d.y, width: d.w, depth: d.d })
  );
}

describe('computeAlignedPositions', () => {
  const layout = createTestLayout();

  it('returns empty when fewer than 2 selected bins', () => {
    const bins = makeBins({ id: 'a', x: 0, y: 0, w: 2, d: 2 });
    expect(computeAlignedPositions(bins, [binId('a')], 'left', layout)).toEqual([]);
  });

  describe('align left', () => {
    it('moves bins to the leftmost x', () => {
      const bins = makeBins(
        { id: 'a', x: 1, y: 0, w: 2, d: 2 },
        { id: 'b', x: 5, y: 3, w: 2, d: 2 }
      );
      const results = computeAlignedPositions(bins, [binId('a'), binId('b')], 'left', layout);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ binId: binId('a'), newX: 1, newY: 0, skipped: false });
      expect(results[1]).toEqual({ binId: binId('b'), newX: 1, newY: 3, skipped: false });
    });
  });

  describe('align right', () => {
    it('moves bins so right edges align to the rightmost right edge', () => {
      const bins = makeBins(
        { id: 'a', x: 0, y: 0, w: 2, d: 2 },
        { id: 'b', x: 6, y: 3, w: 3, d: 2 }
      );
      // rightmost right edge = 6+3 = 9
      const results = computeAlignedPositions(bins, [binId('a'), binId('b')], 'right', layout);

      expect(results[0]).toEqual({ binId: binId('a'), newX: 7, newY: 0, skipped: false });
      expect(results[1]).toEqual({ binId: binId('b'), newX: 6, newY: 3, skipped: false });
    });
  });

  describe('align top', () => {
    it('moves bins so top edges (y+depth) align to the topmost top edge', () => {
      const bins = makeBins(
        { id: 'a', x: 0, y: 0, w: 2, d: 3 },
        { id: 'b', x: 3, y: 4, w: 2, d: 2 }
      );
      // topmost top = max(0+3, 4+2) = 6
      const results = computeAlignedPositions(bins, [binId('a'), binId('b')], 'top', layout);

      expect(results[0]).toEqual({ binId: binId('a'), newX: 0, newY: 3, skipped: false });
      expect(results[1]).toEqual({ binId: binId('b'), newX: 3, newY: 4, skipped: false });
    });
  });

  describe('align bottom', () => {
    it('moves bins to the bottommost y', () => {
      const bins = makeBins(
        { id: 'a', x: 0, y: 2, w: 2, d: 2 },
        { id: 'b', x: 3, y: 5, w: 2, d: 2 }
      );
      const results = computeAlignedPositions(bins, [binId('a'), binId('b')], 'bottom', layout);

      expect(results[0]).toEqual({ binId: binId('a'), newX: 0, newY: 2, skipped: false });
      expect(results[1]).toEqual({ binId: binId('b'), newX: 3, newY: 2, skipped: false });
    });
  });

  it('skips bins that would collide with non-selected blocker', () => {
    // Blocker at x=0..3, y=0..3 (non-selected).
    // Selected bins at x=5 and x=7. Align left → ref=5 → bin 'b' moves to x=5.
    // Neither collides with blocker at this position.
    const blocker = createTestBin({ id: binId('blocker'), x: 0, y: 0, w: 3, d: 3 });
    const selected = makeBins(
      { id: 'a', x: 5, y: 0, w: 2, d: 2 },
      { id: 'b', x: 7, y: 0, w: 2, d: 2 }
    );
    const bins = [blocker, ...selected];
    const results = computeAlignedPositions(
      bins,
      [binId('a'), binId('b')],
      'left',
      createTestLayout({ bins })
    );

    expect(results[0].skipped).toBe(false);
    expect(results[1].skipped).toBe(false);
  });

  it('skips a bin when alignment would overlap a non-selected blocker', () => {
    // Blocker occupies x=0..2, y=0..2. Selected bin 'a' at x=0, y=3 (no conflict).
    // Selected bin 'b' at x=5, y=0. Align left → ref=0 → 'b' tries x=0, y=0 → overlaps blocker.
    const blocker = createTestBin({ id: binId('blocker'), x: 0, y: 0, w: 2, d: 2 });
    const bins = [
      blocker,
      ...makeBins({ id: 'a', x: 0, y: 3, w: 2, d: 2 }, { id: 'b', x: 5, y: 0, w: 2, d: 2 }),
    ];
    const results = computeAlignedPositions(
      bins,
      [binId('a'), binId('b')],
      'left',
      createTestLayout({ bins })
    );

    // 'a' is already at x=0 (no-op, not skipped), 'b' collides with blocker → skipped
    expect(results[0].skipped).toBe(false);
    expect(results[1].skipped).toBe(true);
  });

  it('allows alignment when bins fit within drawer bounds', () => {
    // Drawer is 10 wide. Bin 'b' is 8 wide. Align left → x=0, x+w=8 ≤ 10, valid.
    const bins = makeBins({ id: 'a', x: 0, y: 0, w: 1, d: 1 }, { id: 'b', x: 5, y: 2, w: 8, d: 1 });
    const results = computeAlignedPositions(
      bins,
      [binId('a'), binId('b')],
      'left',
      createTestLayout({ bins })
    );
    expect(results[1].skipped).toBe(false);
  });

  it('excludes staging bins', () => {
    const bins = [
      createTestBin({ id: binId('a'), x: 0, y: 0, width: 2, depth: 2 }),
      createTestBin({ id: binId('b'), x: 5, y: 0, width: 2, depth: 2 }),
      createTestBin({ id: binId('staged'), x: 0, y: 0, width: 1, depth: 1, layerId: STAGING_ID }),
    ];
    const results = computeAlignedPositions(
      bins,
      [binId('a'), binId('b'), binId('staged')],
      'left',
      createTestLayout({ bins })
    );

    // Should only include 2 non-staging bins
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.binId)).not.toContain(binId('staged'));
  });

  it('treats bins already at target as successful (not skipped)', () => {
    const bins = makeBins({ id: 'a', x: 0, y: 0, w: 2, d: 2 }, { id: 'b', x: 0, y: 3, w: 3, d: 2 });
    // align left → ref=0, both already at x=0
    const results = computeAlignedPositions(
      bins,
      [binId('a'), binId('b')],
      'left',
      createTestLayout({ bins })
    );

    expect(results.every((r) => !r.skipped)).toBe(true);
  });

  it('handles all four edges correctly for a simple case', () => {
    const bins = makeBins({ id: 'a', x: 1, y: 1, w: 2, d: 2 }, { id: 'b', x: 5, y: 4, w: 2, d: 2 });
    const ids = [binId('a'), binId('b')];
    const testLayout = createTestLayout({ bins });

    const edges: AlignEdge[] = ['left', 'right', 'top', 'bottom'];
    for (const edge of edges) {
      const results = computeAlignedPositions(bins, ids, edge, testLayout);
      expect(results).toHaveLength(2);
      expect(results.some((r) => r.skipped)).toBe(false);
    }
  });

  it('only includes bins that are in selectedIds', () => {
    const bins = makeBins(
      { id: 'a', x: 0, y: 0, w: 2, d: 2 },
      { id: 'b', x: 5, y: 0, w: 2, d: 2 },
      { id: 'c', x: 3, y: 4, w: 1, d: 1 }
    );
    // Only select a and b, not c
    const results = computeAlignedPositions(
      bins,
      [binId('a'), binId('b')],
      'left',
      createTestLayout({ bins })
    );

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.binId)).toEqual([binId('a'), binId('b')]);
  });

  it('does not collide selected bins with each other', () => {
    // Two bins side by side, align left → they stack at x=0
    // Without exclusion this would be a collision, but selected bins exclude each other
    const bins = makeBins({ id: 'a', x: 0, y: 0, w: 2, d: 2 }, { id: 'b', x: 2, y: 0, w: 2, d: 2 });
    const results = computeAlignedPositions(
      bins,
      [binId('a'), binId('b')],
      'left',
      createTestLayout({ bins })
    );

    // 'b' moves to x=0, overlapping 'a' — but both are selected, so no collision
    expect(results[1]).toEqual({ binId: binId('b'), newX: 0, newY: 0, skipped: false });
  });

  it('works with bins on different layers as long as they share a layer for collision', () => {
    const multiLayerLayout = createTestLayout({
      layers: [
        { id: layerId('layer1'), name: 'Layer 1', height: 3 },
        { id: layerId('layer2'), name: 'Layer 2', height: 3 },
      ],
    });
    const bins = [
      createTestBin({ id: binId('a'), x: 0, y: 0, width: 2, depth: 2, layerId: layerId('layer1') }),
      createTestBin({ id: binId('b'), x: 5, y: 0, width: 2, depth: 2, layerId: layerId('layer1') }),
    ];
    const results = computeAlignedPositions(bins, [binId('a'), binId('b')], 'left', {
      ...multiLayerLayout,
      bins,
    });

    expect(results).toHaveLength(2);
    expect(results[1].newX).toBe(0);
  });
});
