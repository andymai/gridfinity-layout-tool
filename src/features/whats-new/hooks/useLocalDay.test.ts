import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLocalDay } from './useLocalDay';

describe('useLocalDay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves to the next day at local midnight', async () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 30, 23, 59, 0) });
    const { result } = renderHook(() => useLocalDay());
    expect(result.current).toBe('2026-11-30');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    });
    expect(result.current).toBe('2026-12-01');
  });

  it('reads the day again when the tab comes back into view', () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 30, 12), toFake: ['Date'] });
    const { result } = renderHook(() => useLocalDay());
    expect(result.current).toBe('2026-11-30');

    vi.setSystemTime(new Date(2026, 11, 1, 8));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe('2026-12-01');
  });
});
