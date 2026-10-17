import { describe, expect, it, vi } from 'vitest';
import { binId } from '@/core/types';
import { onRevealBin, revealBin } from './revealBin';

describe('revealBin', () => {
  it('reaches every listener until it unsubscribes', () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = onRevealBin(first);
    const stopSecond = onRevealBin(second);

    revealBin(binId('a'));
    stopFirst();
    revealBin(binId('b'));
    stopSecond();

    expect(first.mock.calls).toEqual([['a']]);
    expect(second.mock.calls).toEqual([['a'], ['b']]);
  });
});
