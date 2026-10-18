import { describe, it, expect } from 'vitest';
import { createTestBin } from '@/test/testUtils';
import { binId, gridUnits } from '@/core/types';
import { leadingFirst } from './moveOrder';

const at = (id: string, x: number, y: number) =>
  createTestBin({ id: binId(id), x: gridUnits(x), y: gridUnits(y) });

describe('leadingFirst', () => {
  const column = [at('a', 0, 0), at('b', 0, 1), at('c', 0, 2)];

  it('moves the bin furthest along the move first', () => {
    expect(leadingFirst(column, 0, 1).map((b) => b.id)).toEqual(['c', 'b', 'a']);
    expect(leadingFirst(column, 0, -1).map((b) => b.id)).toEqual(['a', 'b', 'c']);
  });

  it('orders a diagonal move by how far each bin is along it', () => {
    const scattered = [at('a', 0, 0), at('b', 3, 0), at('c', 1, 1)];
    expect(leadingFirst(scattered, 1, 1).map((b) => b.id)).toEqual(['b', 'c', 'a']);
  });
});
