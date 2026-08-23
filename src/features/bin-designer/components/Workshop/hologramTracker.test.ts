import { describe, expect, it } from 'vitest';
import type { PlacedPart } from '@/shared/types/assemblyPlacement';
import { diffNewPartIds } from './hologramTracker';

const placed = (id: string): PlacedPart => ({ selectId: id }) as PlacedPart;

describe('diffNewPartIds', () => {
  it('reports nothing fresh on the first snapshot', () => {
    const { ids, fresh } = diffNewPartIds(null, [placed('a'), placed('b')]);
    expect(fresh).toEqual([]);
    expect(ids).toEqual(new Set(['a', 'b']));
  });

  it('reports only genuinely new ids', () => {
    const first = diffNewPartIds(null, [placed('a')]);
    const second = diffNewPartIds(first.ids, [placed('a'), placed('b')]);
    expect(second.fresh).toEqual(['b']);
  });

  it('array copies of one node stay one id', () => {
    const first = diffNewPartIds(null, [placed('a')]);
    const second = diffNewPartIds(first.ids, [placed('a'), placed('a'), placed('b')]);
    expect(second.fresh).toEqual(['b']);
  });
});
