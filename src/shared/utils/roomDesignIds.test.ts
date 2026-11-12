import { describe, it, expect } from 'vitest';
import { roomDesignIds } from './roomDesignIds';
import { binId, designId, gridUnits } from '@/core/types';
import type { Layout } from '@/core/types';
import { createTestBin, createTestLayout } from '@/test/testUtils';

function layoutLinkedTo(...ids: (string | undefined)[]): Layout {
  return createTestLayout({
    bins: ids.map((id, i) =>
      createTestBin({
        id: binId(`bin-${i}`),
        x: gridUnits(i),
        ...(id ? { linkedDesignId: designId(id) } : {}),
      })
    ),
  });
}

function linkedIds(layout: Layout): (string | undefined)[] {
  return layout.bins.map((bin) => bin.linkedDesignId);
}

describe('roomDesignIds', () => {
  const ids = roomDesignIds({ 'owner-a': 'local-a', 'owner-b': 'local-b' });

  it("gives this browser's ids to a room layout", () => {
    expect(linkedIds(ids.toLocal(layoutLinkedTo('owner-a', 'owner-b', undefined)))).toEqual([
      'local-a',
      'local-b',
      undefined,
    ]);
  });

  it("gives the owner's ids back to a local layout", () => {
    expect(linkedIds(ids.toRoom(layoutLinkedTo('local-b', 'local-a')))).toEqual([
      'owner-b',
      'owner-a',
    ]);
  });

  it('round-trips a room layout', () => {
    const room = layoutLinkedTo('owner-a', 'owner-b');
    expect(ids.toRoom(ids.toLocal(room))).toEqual(room);
  });

  it('leaves an id it does not know as it is', () => {
    expect(linkedIds(ids.toLocal(layoutLinkedTo('another-design')))).toEqual(['another-design']);
    expect(linkedIds(ids.toRoom(layoutLinkedTo('my-own-design')))).toEqual(['my-own-design']);
  });

  it('returns the same layout when no bin changes', () => {
    const layout = layoutLinkedTo('another-design', undefined);
    expect(ids.toLocal(layout)).toBe(layout);
    expect(ids.toRoom(layout)).toBe(layout);
  });

  it('changes nothing for the owner', () => {
    const layout = layoutLinkedTo('owner-a');
    for (const owner of [roomDesignIds(undefined), roomDesignIds({})]) {
      expect(owner.toLocal(layout)).toBe(layout);
      expect(owner.toRoom(layout)).toBe(layout);
    }
  });
});
