import { describe, it, expect } from 'vitest';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { binId, gridUnits, heightUnits } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import type { Bin } from '@/core/types';
import { changeOrder, landUpdates } from './changeOrder';

const layout = createTestLayout({
  drawer: { width: gridUnits(10), depth: gridUnits(10), height: heightUnits(20) },
});

const at = (id: string, x: number, y: number, overrides: Partial<Bin> = {}): Bin =>
  createTestBin({ id: binId(id), x: gridUnits(x), y: gridUnits(y), ...overrides });

describe('changeOrder', () => {
  it('changes a bin that leaves a spot before the bin that takes it', () => {
    const shrinking = at('shrinking', 0, 0, { width: gridUnits(3) });
    const growing = at('growing', 0, 1);
    const order = changeOrder(
      [
        { bin: growing, to: { ...growing, depth: gridUnits(2), y: gridUnits(0), x: gridUnits(2) } },
        { bin: shrinking, to: { ...shrinking, width: gridUnits(1) } },
      ],
      layout
    );
    expect(order.map((b) => b.id)).toEqual(['shrinking', 'growing']);
  });

  it('keeps the given order for bins that wait on each other', () => {
    const a = at('a', 0, 0);
    const b = at('b', 2, 0);
    const swapped = changeOrder(
      [
        { bin: a, to: { ...a, x: gridUnits(2) } },
        { bin: b, to: { ...b, x: gridUnits(0) } },
      ],
      layout
    );
    expect(swapped.map((bin) => bin.id)).toEqual(['a', 'b']);
  });

  it('neither waits for nor holds up a bin in the stash', () => {
    const stashed = at('stashed', 0, 0, { layerId: STAGING_ID, width: gridUnits(3) });
    const growing = at('growing', 0, 1);
    const order = changeOrder(
      [
        { bin: growing, to: { ...growing, y: gridUnits(0) } },
        { bin: stashed, to: { ...stashed, width: gridUnits(1) } },
      ],
      layout
    );
    expect(order.map((b) => b.id)).toEqual(['growing', 'stashed']);
  });
});

describe('landUpdates', () => {
  it('names the first update refused against the layout the ones before it leave', () => {
    const first = at('first', 0, 0);
    const second = at('second', 4, 0);
    const both = { ...layout, bins: [first, second] };
    expect(
      landUpdates(
        [
          { id: first.id, updates: { x: gridUnits(2) } },
          { id: second.id, updates: { x: gridUnits(2) } },
        ],
        both
      )
    ).toMatchObject({ lands: false, refused: 'second' });
    expect(landUpdates([{ id: first.id, updates: { x: gridUnits(2) } }], both)).toEqual({
      lands: true,
    });
  });
});
