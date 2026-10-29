import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAchievements } from './useAchievements';
import { readAchievements } from '../utils/achievements';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('useAchievements', () => {
  it('announces a first unlock and remembers it', () => {
    const { result } = renderHook(() => useAchievements());
    act(() => result.current.unlock('poked10'));
    expect(result.current.toast).toBe('poked10');
    expect(readAchievements().has('poked10')).toBe(true);
  });

  it('stays quiet about one already earned, even on a later visit', () => {
    const first = renderHook(() => useAchievements());
    act(() => first.result.current.unlock('poked10'));
    first.unmount();
    const { result } = renderHook(() => useAchievements());
    act(() => result.current.unlock('poked10'));
    expect(result.current.toast).toBeNull();
  });

  it('keeps awards another tab saved meanwhile', () => {
    const { result } = renderHook(() => useAchievements());
    act(() => result.current.unlock('speedrunner'));
    localStorage.setItem('gridfinity-supporters-achievement-postCredits', '1');
    act(() => result.current.unlock('poked10'));
    expect([...readAchievements()].sort()).toEqual(['poked10', 'postCredits', 'speedrunner']);
  });

  it('queues unlocks that land together and shows them in turn', () => {
    const { result } = renderHook(() => useAchievements());
    act(() => {
      result.current.unlock('speedrunner');
      result.current.unlock('foundOwnBin');
    });
    expect(result.current.toast).toBe('speedrunner');
    act(() => vi.advanceTimersByTime(4200));
    expect(result.current.toast).toBe('foundOwnBin');
    act(() => vi.advanceTimersByTime(4200));
    expect(result.current.toast).toBeNull();
  });
});
