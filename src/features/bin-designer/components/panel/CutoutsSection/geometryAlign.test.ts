import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { alignSelection, distributeSelection } from './geometryAlign';

function cutout(over: Partial<Cutout> & { id: string }): Cutout {
  return {
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    groupId: null,
    locked: false,
    hidden: false,
    ...over,
  } as Cutout;
}

describe('alignSelection', () => {
  it('does nothing with fewer than two cutouts', () => {
    expect(alignSelection([cutout({ id: 'a', x: 5 })], 'left').size).toBe(0);
    expect(alignSelection([], 'left').size).toBe(0);
  });

  it('aligns left edges to the leftmost cutout', () => {
    const cutouts = [cutout({ id: 'a', x: 5 }), cutout({ id: 'b', x: 20 })];

    const updates = alignSelection(cutouts, 'left');

    expect(updates.get('b')?.x).toBe(5);
    // The anchor is already in place, so it gets no patch.
    expect(updates.has('a')).toBe(false);
  });

  it('aligns right edges accounting for differing widths', () => {
    const cutouts = [cutout({ id: 'a', x: 0, width: 30 }), cutout({ id: 'b', x: 0, width: 10 })];

    const updates = alignSelection(cutouts, 'right');

    // b's right edge must land on a's right edge (30), so x = 30 - 10.
    expect(updates.get('b')?.x).toBe(20);
  });

  it('centres horizontally on the selection midpoint', () => {
    const cutouts = [cutout({ id: 'a', x: 0, width: 10 }), cutout({ id: 'b', x: 30, width: 10 })];

    const updates = alignSelection(cutouts, 'centerX');

    // Selection spans 0..40, midpoint 20; each 10-wide cutout centres at x=15.
    expect(updates.get('a')?.x).toBe(15);
    expect(updates.get('b')?.x).toBe(15);
  });

  it('aligns vertically without touching x', () => {
    const cutouts = [cutout({ id: 'a', x: 3, y: 0 }), cutout({ id: 'b', x: 40, y: 25 })];

    const updates = alignSelection(cutouts, 'top');

    expect(updates.get('b')?.y).toBe(0);
    expect(updates.get('b')?.x).toBe(40);
  });

  it('aligns bottom edges', () => {
    const cutouts = [cutout({ id: 'a', y: 0, depth: 30 }), cutout({ id: 'b', y: 0, depth: 10 })];

    expect(alignSelection(cutouts, 'bottom').get('b')?.y).toBe(20);
  });

  it('centres vertically', () => {
    const cutouts = [cutout({ id: 'a', y: 0, depth: 10 }), cutout({ id: 'b', y: 30, depth: 10 })];

    const updates = alignSelection(cutouts, 'middleY');

    expect(updates.get('a')?.y).toBe(15);
    expect(updates.get('b')?.y).toBe(15);
  });

  // Locked shapes anchor: they hold position but still define the bounds, so
  // "lock a reference hole then align the rest to it" works.
  it('never moves a locked cutout but still counts it in the bounds', () => {
    const cutouts = [
      cutout({ id: 'anchor', x: 5, locked: true }),
      cutout({ id: 'b', x: 40 }),
      cutout({ id: 'c', x: 80 }),
    ];

    const updates = alignSelection(cutouts, 'left');

    expect(updates.has('anchor')).toBe(false);
    expect(updates.get('b')?.x).toBe(5);
    expect(updates.get('c')?.x).toBe(5);
  });

  it('produces no updates when every cutout is locked', () => {
    const cutouts = [
      cutout({ id: 'a', x: 0, locked: true }),
      cutout({ id: 'b', x: 40, locked: true }),
    ];

    expect(alignSelection(cutouts, 'left').size).toBe(0);
  });

  it('skips cutouts that are already in position', () => {
    const cutouts = [cutout({ id: 'a', x: 10 }), cutout({ id: 'b', x: 10 })];

    expect(alignSelection(cutouts, 'left').size).toBe(0);
  });

  // A cutout's x/y is its UNROTATED top-left, but alignment is judged on the
  // rotated silhouette — so the two only agree if the move is a translation.
  it('aligns a rotated cutout by its rotated silhouette', () => {
    const cutouts = [
      cutout({ id: 'a', x: 0, y: 0, width: 20, depth: 10 }),
      cutout({ id: 'b', x: 50, y: 0, width: 20, depth: 10, rotation: 90 }),
    ];

    const updates = alignSelection(cutouts, 'left');

    // b rotated 90° spans x 55..65 (centre 60, half-extent 5). Its left edge
    // must land on 0, a translation of -55 — which lands the UNROTATED origin
    // at -5. The two disagreeing is exactly why this moves by delta.
    expect(updates.get('b')?.x).toBeCloseTo(-5, 6);
  });

  // Path points are absolute, so a move that doesn't carry them detaches the
  // geometry from the reported position.
  it('translates a path cutout’s points along with its origin', () => {
    const path = [
      { x: 20, y: 0, handleIn: null, handleOut: null, symmetric: false },
      { x: 30, y: 10, handleIn: null, handleOut: null, symmetric: false },
    ];
    const cutouts = [
      cutout({ id: 'a', x: 0 }),
      cutout({ id: 'b', shape: 'path', x: 20, width: 10, depth: 10, path }),
    ];

    const updates = alignSelection(cutouts, 'left');
    const patch = updates.get('b');

    expect(patch?.x).toBe(0);
    expect(patch?.path?.map((p) => p.x)).toEqual([0, 10]);
    expect(patch?.path?.map((p) => p.y)).toEqual([0, 10]);
  });
});

describe('distributeSelection', () => {
  it('does nothing below three cutouts', () => {
    const two = [cutout({ id: 'a', x: 0 }), cutout({ id: 'b', x: 100 })];

    expect(distributeSelection(two, 'horizontal').size).toBe(0);
  });

  it('evenly spaces centres horizontally, leaving the extremes fixed', () => {
    const cutouts = [
      cutout({ id: 'a', x: 0 }),
      cutout({ id: 'b', x: 10 }),
      cutout({ id: 'c', x: 100 }),
    ];

    const updates = distributeSelection(cutouts, 'horizontal');

    expect(updates.has('a')).toBe(false);
    expect(updates.has('c')).toBe(false);
    expect(updates.get('b')?.x).toBe(50);
  });

  it('spaces by centre, not by gap, so mixed sizes keep a constant pitch', () => {
    // Centres at 5, 20, 105 — the drill-index case: different diameters, even pitch.
    const cutouts = [
      cutout({ id: 'a', x: 0, width: 10 }),
      cutout({ id: 'b', x: 10, width: 20 }),
      cutout({ id: 'c', x: 100, width: 10 }),
    ];

    const updates = distributeSelection(cutouts, 'horizontal');

    // Target centre for the middle shape is (5 + 105) / 2 = 55, so x = 55 - 10.
    expect(updates.get('b')?.x).toBe(45);
  });

  it('orders by position rather than by array order', () => {
    const cutouts = [
      cutout({ id: 'c', x: 100 }),
      cutout({ id: 'a', x: 0 }),
      cutout({ id: 'b', x: 90 }),
    ];

    expect(distributeSelection(cutouts, 'horizontal').get('b')?.x).toBe(50);
  });

  it('distributes vertically without touching x', () => {
    const cutouts = [
      cutout({ id: 'a', x: 7, y: 0 }),
      cutout({ id: 'b', x: 7, y: 5 }),
      cutout({ id: 'c', x: 7, y: 100 }),
    ];

    const updates = distributeSelection(cutouts, 'vertical');

    expect(updates.get('b')?.y).toBe(50);
    expect(updates.get('b')?.x).toBe(7);
  });

  it('leaves a locked interior cutout where it is', () => {
    const cutouts = [
      cutout({ id: 'a', x: 0 }),
      cutout({ id: 'b', x: 10, locked: true }),
      cutout({ id: 'c', x: 100 }),
    ];

    expect(distributeSelection(cutouts, 'horizontal').size).toBe(0);
  });

  // A locked anchor splits the run into independently spaced segments. Spacing
  // the whole span at once and merely skipping the locked shape would place
  // everything as if the anchor had moved to its even-spacing slot.
  it('distributes each side of a locked anchor independently', () => {
    const cutouts = [
      cutout({ id: 'a', x: 0 }), //   centre   5
      cutout({ id: 'b', x: 5 }), //   centre  10  → segment a..anchor
      cutout({ id: 'anchor', x: 20, locked: true }), // centre 25
      cutout({ id: 'd', x: 90 }), //  centre  95  → segment anchor..e
      cutout({ id: 'e', x: 100 }), // centre 105
    ];

    const updates = distributeSelection(cutouts, 'horizontal');

    expect(updates.has('anchor')).toBe(false);
    // Segment 1 spans centres 5..25 with one shape between → target centre 15.
    expect(updates.get('b')?.x).toBe(10);
    // Segment 2 spans centres 25..105 with one shape between → target centre 65.
    expect(updates.get('d')?.x).toBe(60);
  });

  it('handles two locked anchors, spacing all three segments', () => {
    const cutouts = [
      cutout({ id: 'a', x: 0 }), //     centre   5
      cutout({ id: 'b', x: 5 }), //     centre  10
      cutout({ id: 'lock1', x: 20, locked: true }), // centre 25
      cutout({ id: 'c', x: 30 }), //    centre  35
      cutout({ id: 'lock2', x: 60, locked: true }), // centre 65
      cutout({ id: 'd', x: 70 }), //    centre  75
      cutout({ id: 'e', x: 100 }), //   centre 105
    ];

    const updates = distributeSelection(cutouts, 'horizontal');

    expect(updates.has('lock1')).toBe(false);
    expect(updates.has('lock2')).toBe(false);
    expect(updates.get('b')?.x).toBe(10); // midpoint of 5..25  → centre 15
    expect(updates.get('c')?.x).toBe(40); // midpoint of 25..65 → centre 45
    expect(updates.get('d')?.x).toBe(80); // midpoint of 65..105 → centre 85
  });

  // Locking an extreme changes nothing: the endpoints were already fixed.
  it('is unaffected by a locked endpoint', () => {
    const withLock = [
      cutout({ id: 'a', x: 0, locked: true }),
      cutout({ id: 'b', x: 10 }),
      cutout({ id: 'c', x: 100 }),
    ];

    expect(distributeSelection(withLock, 'horizontal').get('b')?.x).toBe(50);
  });

  it('produces nothing when every interior shape is locked', () => {
    const cutouts = [
      cutout({ id: 'a', x: 0 }),
      cutout({ id: 'b', x: 10, locked: true }),
      cutout({ id: 'c', x: 40, locked: true }),
      cutout({ id: 'd', x: 100 }),
    ];

    expect(distributeSelection(cutouts, 'horizontal').size).toBe(0);
  });

  it('skips cutouts already evenly spaced', () => {
    const cutouts = [
      cutout({ id: 'a', x: 0 }),
      cutout({ id: 'b', x: 50 }),
      cutout({ id: 'c', x: 100 }),
    ];

    expect(distributeSelection(cutouts, 'horizontal').size).toBe(0);
  });

  it('translates path points when distributing', () => {
    const path = [{ x: 10, y: 0, handleIn: null, handleOut: null, symmetric: false }];
    const cutouts = [
      cutout({ id: 'a', x: 0 }),
      cutout({ id: 'b', shape: 'path', x: 10, path }),
      cutout({ id: 'c', x: 100 }),
    ];

    const patch = distributeSelection(cutouts, 'horizontal').get('b');

    expect(patch?.x).toBe(50);
    expect(patch?.path?.[0].x).toBe(50);
  });
});

describe('groups are rigid (#3468)', () => {
  it('aligns a group by its combined box, preserving member offsets', () => {
    const cutouts = [
      cutout({ id: 'g1a', groupId: 'g1', x: 40 }),
      cutout({ id: 'g1b', groupId: 'g1', x: 70 }),
      cutout({ id: 'solo', x: 5 }),
    ];

    const updates = alignSelection(cutouts, 'left');

    // The group moves as one: both members shift by the same 35mm.
    expect(updates.get('g1a')?.x).toBe(5);
    expect(updates.get('g1b')?.x).toBe(35);
    expect(updates.has('solo')).toBe(false);
  });

  it('is a no-op when the whole selection is one group', () => {
    const cutouts = [
      cutout({ id: 'a', groupId: 'g1', x: 0 }),
      cutout({ id: 'b', groupId: 'g1', x: 40 }),
    ];

    // One unit has nothing to align against — the members must not collapse
    // onto each other.
    expect(alignSelection(cutouts, 'left').size).toBe(0);
  });

  it('never moves a group holding a locked member', () => {
    const cutouts = [
      cutout({ id: 'a', groupId: 'g1', x: 40 }),
      cutout({ id: 'b', groupId: 'g1', x: 70, locked: true }),
      cutout({ id: 'solo', x: 5 }),
    ];

    const updates = alignSelection(cutouts, 'left');

    expect(updates.size).toBe(0);
  });

  it('distributes by unit centre, counting a group once', () => {
    // Three units: solo(0), group spanning 40..90, solo(200).
    const cutouts = [
      cutout({ id: 'left', x: 0 }),
      cutout({ id: 'ga', groupId: 'g1', x: 40 }),
      cutout({ id: 'gb', groupId: 'g1', x: 80 }),
      cutout({ id: 'right', x: 200 }),
    ];

    const updates = distributeSelection(cutouts, 'horizontal');

    // Extremes anchor; the group's centre lands midway between them.
    expect(updates.has('left')).toBe(false);
    expect(updates.has('right')).toBe(false);
    const da = (updates.get('ga')?.x ?? 0) - 40;
    const db = (updates.get('gb')?.x ?? 0) - 80;
    expect(da).toBeCloseTo(db);
  });

  it('needs three units, not three cutouts, to distribute', () => {
    const cutouts = [
      cutout({ id: 'a', groupId: 'g1', x: 0 }),
      cutout({ id: 'b', groupId: 'g1', x: 20 }),
      cutout({ id: 'c', x: 100 }),
    ];

    // Two units — nothing to place between the extremes.
    expect(distributeSelection(cutouts, 'horizontal').size).toBe(0);
  });
});
