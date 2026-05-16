// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutStore } from '@/core/store';
import { useDebouncedPush } from './useDebouncedPush';

const flushNowMock = vi.fn();

vi.mock('../engine', () => ({
  flushNow: () => flushNowMock(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  flushNowMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedPush', () => {
  it('does not flush on mount (no edits yet)', () => {
    renderHook(() => useDebouncedPush());
    vi.advanceTimersByTime(5_000);
    expect(flushNowMock).not.toHaveBeenCalled();
  });

  it('debounces 3 seconds after a layout change', () => {
    const { rerender } = renderHook(() => useDebouncedPush());

    act(() => {
      useLayoutStore.setState((s) => ({ ...s, layout: { ...s.layout, name: 'Renamed' } }));
    });
    rerender();

    vi.advanceTimersByTime(2_999);
    expect(flushNowMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(flushNowMock).toHaveBeenCalledTimes(1);
  });

  it('coalesces rapid edits into a single flush', () => {
    const { rerender } = renderHook(() => useDebouncedPush());

    for (let i = 0; i < 5; i++) {
      act(() => {
        useLayoutStore.setState((s) => ({ ...s, layout: { ...s.layout, name: `n${i}` } }));
      });
      rerender();
      vi.advanceTimersByTime(500);
    }

    expect(flushNowMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3_000);
    expect(flushNowMock).toHaveBeenCalledTimes(1);
  });

  it('skips flush when lastEditSource is "remote"', () => {
    const { rerender } = renderHook(() => useDebouncedPush());

    act(() => {
      useLayoutStore.setState((s) => ({
        ...s,
        layout: { ...s.layout, name: 'Pulled' },
        lastEditSource: 'remote',
      }));
    });
    rerender();

    vi.advanceTimersByTime(5_000);
    expect(flushNowMock).not.toHaveBeenCalled();
  });
});
