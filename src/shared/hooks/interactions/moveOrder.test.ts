import { describe, it, expect } from 'vitest';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { binId, gridUnits, heightUnits, layerId } from '@/core/types';
import type { Bin, Layout } from '@/core/types';
import { canPlaceBin } from '@/shared/utils/validationPlacement';
import { groupMoveLands, moveOrder } from './moveOrder';

const layout = createTestLayout({
  drawer: { width: gridUnits(10), depth: gridUnits(10), height: heightUnits(20) },
});

const at = (id: string, x: number, y: number, overrides: Partial<Bin> = {}): Bin =>
  createTestBin({ id: binId(id), x: gridUnits(x), y: gridUnits(y), ...overrides });

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
    expect(ids(moveOrder(column, 0, 1, layout))).toEqual(['c', 'b', 'a']);
    expect(ids(moveOrder(column, 0, -1, layout))).toEqual(['a', 'b', 'c']);
  });

  it('moves a wide bin before a small one whose new spot it still covers', () => {
    const wide = at('wide', 0, 2, { width: gridUnits(6) });
    const small = at('small', 4, 0, { depth: gridUnits(2) });
    expect(ids(moveOrder([small, wide], 1, 1, layout))).toEqual(['wide', 'small']);
    const both = { ...layout, bins: [small, wide] };
    expect(movedInTurn(moveOrder([small, wide], 1, 1, both), 1, 1, both)).toBe(2);
    expect(movedInTurn([small, wide], 1, 1, both)).toBe(1);
  });

  it("waits for a bin that a slanted bin's support moves onto", () => {
    const leaning = at('leaning', 3, 3, {
      height: heightUnits(6),
      slant: { angleDeg: 45, side: 'right', endSupport: true },
    });
    const tall = at('tall', 5, 0, { depth: gridUnits(5) });
    expect(ids(moveOrder([leaning, tall], 1, 1, layout))).toEqual(['tall', 'leaning']);
    const both = { ...layout, bins: [leaning, tall] };
    expect(movedInTurn(moveOrder([leaning, tall], 1, 1, both), 1, 1, both)).toBe(2);
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
    expect(ids(moveOrder([held, tall], 1, 1, both))).toEqual(['tall', 'held']);
    expect(movedInTurn(moveOrder([held, tall], 1, 1, both), 1, 1, both)).toBe(2);
  });

  it('ignores a bin on another layer unless one of them leans', () => {
    const wide = at('wide', 0, 2, { width: gridUnits(6) });
    const small = at('small', 4, 0, { depth: gridUnits(2), layerId: layerId('layer2') });
    expect(ids(moveOrder([wide, small], 1, 1, layout))).toEqual(['small', 'wide']);
  });
});

describe('groupMoveLands', () => {
  const L1 = layerId('layer1');

  it('lands a group whose order leaves no bin waiting', () => {
    const wide = at('wide', 0, 2, { width: gridUnits(6) });
    const small = at('small', 4, 0, { depth: gridUnits(2) });
    const both = { ...layout, bins: [small, wide] };
    expect(groupMoveLands(moveOrder([small, wide], 1, 1, both), 1, 1, L1, both)).toBe(true);
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
    expect(groupMoveLands(moveOrder([held, beside], 1, 0, both), 1, 0, L1, both)).toBe(false);
  });
});
