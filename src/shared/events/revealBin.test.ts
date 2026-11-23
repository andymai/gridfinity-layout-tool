import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { binId } from '@/core/types';
import { __resetRevealForTests, onRevealBin, revealBin } from './revealBin';

describe('revealBin', () => {
  beforeEach(() => {
    __resetRevealForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reaches every listener until it unsubscribes', () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = onRevealBin('grid', first);
    const stopSecond = onRevealBin('stash', second);

    revealBin(binId('a'));
    stopFirst();
    revealBin(binId('b'));
    stopSecond();

    expect(first.mock.calls).toEqual([['a']]);
    expect(second.mock.calls).toEqual([['a'], ['b']]);
  });

  it('reaches every surface that is mounted', () => {
    const grid = vi.fn();
    const stash = vi.fn();
    onRevealBin('grid', grid);
    onRevealBin('stash', stash);

    revealBin(binId('b1'));

    expect(grid).toHaveBeenCalledWith('b1');
    expect(stash).toHaveBeenCalledWith('b1');
  });

  it('waits for the surfaces when none is mounted yet, and gives it to each of them', () => {
    revealBin(binId('b1'));
    vi.advanceTimersByTime(3000);

    const grid = vi.fn();
    const stash = vi.fn();
    onRevealBin('grid', grid);
    onRevealBin('stash', stash);

    expect(grid).toHaveBeenCalledWith('b1');
    expect(stash).toHaveBeenCalledWith('b1');
  });

  it('drops a waiting reveal after ten seconds', () => {
    revealBin(binId('b1'));
    vi.advanceTimersByTime(10_001);

    const grid = vi.fn();
    onRevealBin('grid', grid);

    expect(grid).not.toHaveBeenCalled();
  });

  it('does not replay a reveal that a mounted surface already took', () => {
    const unsubscribe = onRevealBin('grid', vi.fn());
    revealBin(binId('b1'));
    unsubscribe();

    const remounted = vi.fn();
    onRevealBin('grid', remounted);

    expect(remounted).not.toHaveBeenCalled();
  });

  it('gives a waiting reveal to each surface once, so a remount does not replay it', () => {
    revealBin(binId('b1'));

    const grid = vi.fn();
    const stopGrid = onRevealBin('grid', grid);
    stopGrid();
    vi.advanceTimersByTime(2000);
    const remountedGrid = vi.fn();
    onRevealBin('grid', remountedGrid);
    const stash = vi.fn();
    onRevealBin('stash', stash);

    expect(grid).toHaveBeenCalledWith('b1');
    expect(remountedGrid).not.toHaveBeenCalled();
    expect(stash).toHaveBeenCalledWith('b1');
  });
});
