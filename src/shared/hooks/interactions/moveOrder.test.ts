import { describe, it, expect } from 'vitest';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { binId, gridUnits, heightUnits, layerId } from '@/core/types';
import type { Bin, Layout } from '@/core/types';
import { canPlaceBin } from '@/shared/utils/validationPlacement';
import { landUpdates } from '@/shared/utils/changeOrder';
import { STAGING_ID } from '@/core/constants';
import { groupMoveLands, moveOrder, swapLands, swapUpdates } from './moveOrder';

const layout = createTestLayout({
  drawer: { width: gridUnits(10), depth: gridUnits(10), height: heightUnits(20) },
});

const at = (id: string, x: number, y: number, overrides: Partial<Bin> = {}): Bin =>
  createTestBin({ id: binId(id), x: gridUnits(x), y: gridUnits(y), ...overrides });

const L1 = layerId('layer1');

const ids = (bins: Bin[]): string[] => bins.map((b) => b.id);

/** How many of the bins placement accepts when each moves in turn, as the drop does. */
function movedInTurn(order: Bin[], dx: number, dy: number, start: Layout): number {
  let current = start;
  let moved = 0;
  for (const bin of order) {
    const { overhang: _dropped, ...rest } = bin;
    const to = { ...rest, x: gridUnits(bin.x + dx), y: gridUnits(bin.y + dy) };
    if (!canPlaceBin(to, bin.layerId, current, bin.id).valid) continue;
    current = { ...current, bins: current.bins.map((b) => (b.id === bin.id ? to : b)) };
    moved++;
  }
  return moved;
}

describe('moveOrder', () => {
  const column = [at('a', 0, 0), at('b', 0, 1), at('c', 0, 2)];

  it('moves the bin furthest along the move first', () => {
    expect(ids(moveOrder(column, 0, 1, L1, layout))).toEqual(['c', 'b', 'a']);
    expect(ids(moveOrder(column, 0, -1, L1, layout))).toEqual(['a', 'b', 'c']);
  });

  it('moves a wide bin before a small one whose new spot it still covers', () => {
    const wide = at('wide', 0, 2, { width: gridUnits(6) });
    const small = at('small', 4, 0, { depth: gridUnits(2) });
    expect(ids(moveOrder([small, wide], 1, 1, L1, layout))).toEqual(['wide', 'small']);
    const both = { ...layout, bins: [small, wide] };
    expect(movedInTurn(moveOrder([small, wide], 1, 1, L1, both), 1, 1, both)).toBe(2);
    expect(movedInTurn([small, wide], 1, 1, both)).toBe(1);
  });

  it("waits for a bin that a slanted bin's support moves onto", () => {
    const leaning = at('leaning', 3, 3, {
      height: heightUnits(6),
      slant: { angleDeg: 45, side: 'right', endSupport: true },
    });
    const tall = at('tall', 5, 0, { depth: gridUnits(5) });
    expect(ids(moveOrder([leaning, tall], 1, 1, L1, layout))).toEqual(['tall', 'leaning']);
    const both = { ...layout, bins: [leaning, tall] };
    expect(movedInTurn(moveOrder([leaning, tall], 1, 1, L1, both), 1, 1, both)).toBe(2);
    expect(movedInTurn([leaning, tall], 1, 1, both)).toBe(1);
  });

  it('counts the support of a bin whose overhang, dropped by the move, held it upright', () => {
    const held = at('held', 3, 3, {
      height: heightUnits(6),
      slant: { angleDeg: 45, side: 'right', endSupport: true },
      overhang: { left: 0, right: 5, front: 0, back: 0 },
    });
    const tall = at('tall', 5, 0, { depth: gridUnits(5) });
    const both = { ...layout, bins: [held, tall] };
    expect(ids(moveOrder([held, tall], 1, 1, L1, both))).toEqual(['tall', 'held']);
    expect(movedInTurn(moveOrder([held, tall], 1, 1, L1, both), 1, 1, both)).toBe(2);
  });

  // The drop puts every bin of the group on one layer, whichever it left.
  it('waits for a bin on another layer whose spot it lands on', () => {
    const wide = at('wide', 0, 2, { width: gridUnits(6) });
    const small = at('small', 4, 0, { depth: gridUnits(2), layerId: layerId('layer2') });
    const both = { ...layout, bins: [wide, small] };
    const order = moveOrder([wide, small], 1, 1, L1, both);
    expect(ids(order)).toEqual(['wide', 'small']);
    expect(groupMoveLands(order, 1, 1, L1, both)).toBe(true);
  });
});

describe('groupMoveLands', () => {
  it('lands a group whose order leaves no bin waiting', () => {
    const wide = at('wide', 0, 2, { width: gridUnits(6) });
    const small = at('small', 4, 0, { depth: gridUnits(2) });
    const both = { ...layout, bins: [small, wide] };
    expect(groupMoveLands(moveOrder([small, wide], 1, 1, L1, both), 1, 1, L1, both)).toBe(true);
  });

  // The overhang that held the leading bin upright goes with the move, and its
  // support then lands where the bin beside it has moved.
  it('refuses a group that would stop part way', () => {
    const held = at('held', 0, 0, {
      height: heightUnits(6),
      slant: { angleDeg: 45, side: 'right', endSupport: true },
      overhang: { left: 0, right: 5, front: 0, back: 0 },
    });
    const beside = at('beside', 1, 0, { height: heightUnits(6) });
    const both = { ...layout, bins: [held, beside] };
    expect(groupMoveLands(moveOrder([held, beside], 1, 0, L1, both), 1, 0, L1, both)).toBe(false);
  });
});

describe('swapUpdates', () => {
  const square = (id: string, x: number, overrides: Partial<Bin> = {}): Bin =>
    at(id, x, 0, { width: gridUnits(2), depth: gridUnits(2), ...overrides });

  it('lands a swap of two bins that two plain moves cannot', () => {
    const a = square('a', 0);
    const b = square('b', 2);
    const both = { ...layout, bins: [a, b] };
    const aToB = { id: a.id, updates: { x: gridUnits(2), y: gridUnits(0) } };
    const bToA = { id: b.id, updates: { x: gridUnits(0), y: gridUnits(0) } };
    expect(landUpdates([aToB, bToA], both).lands).toBe(false);
    expect(landUpdates([bToA, aToB], both).lands).toBe(false);

    expect(swapLands(a, b, false, both)).toBe(true);
  });

  it('ends with each bin on the spot the other left, back on its layer', () => {
    const a = square('a', 0);
    const b = square('b', 4);
    const [, toTarget, back] = swapUpdates(a, b, false);
    expect(toTarget).toEqual({ id: b.id, updates: { x: 0, y: 0 } });
    expect(back).toEqual({
      id: a.id,
      updates: { layerId: L1, x: 4, y: 0, width: 2, depth: 2 },
    });
  });

  it('turns the dragged bin a quarter for a rotated match', () => {
    const tall = at('tall', 0, 0, { width: gridUnits(2), depth: gridUnits(3) });
    const wide = at('wide', 4, 0, { width: gridUnits(3), depth: gridUnits(2) });
    const both = { ...layout, bins: [tall, wide] };
    expect(swapUpdates(tall, wide, true)[2].updates).toMatchObject({ width: 3, depth: 2 });
    expect(swapLands(tall, wide, true, both)).toBe(true);
  });

  // The target keeps its own size, so after a rotated swap it reaches one
  // column past the dragged bin's old spot, onto the turned bin.
  it('refuses a rotated swap whose bins would overlap afterwards', () => {
    const tall = at('tall', 0, 0, { width: gridUnits(2), depth: gridUnits(3) });
    const wide = at('wide', 2, 0, { width: gridUnits(3), depth: gridUnits(2) });
    const both = { ...layout, bins: [tall, wide] };
    expect(swapLands(tall, wide, true, both)).toBe(false);
  });

  it('refuses a target that is half of a pair placed on its layer', () => {
    const a = square('a', 0);
    const block = square('block', 4, { pairId: 'knife' });
    const rest = square('rest', 7, { pairId: 'knife' });
    const placed = { ...layout, bins: [a, block, rest] };
    expect(swapLands(a, block, false, placed)).toBe(false);
  });

  it('swaps a target whose pairId has no partner on the grid', () => {
    const a = square('a', 0);
    const block = square('block', 4, { pairId: 'knife' });
    expect(swapLands(a, block, false, { ...layout, bins: [a, block] })).toBe(true);

    const stashed = square('rest', 0, { pairId: 'knife', layerId: STAGING_ID });
    expect(swapLands(a, block, false, { ...layout, bins: [a, block, stashed] })).toBe(true);
  });
});
