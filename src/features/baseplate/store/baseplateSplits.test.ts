import { describe, expect, it, vi } from 'vitest';
import { baseplateDesignId, layoutId } from '@/core/types';
import { announceBaseplateSplit, onBaseplateSplit } from './baseplateSplits';

describe('baseplate splits', () => {
  it('tells every listener until it unsubscribes', () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = onBaseplateSplit(first);
    const stopSecond = onBaseplateSplit(second);

    announceBaseplateSplit(layoutId('a'), baseplateDesignId('shared'));
    stopFirst();
    announceBaseplateSplit(layoutId('b'), baseplateDesignId('shared'));
    stopSecond();

    expect(first.mock.calls).toEqual([['a', 'shared']]);
    expect(second.mock.calls).toEqual([
      ['a', 'shared'],
      ['b', 'shared'],
    ]);
  });
});
