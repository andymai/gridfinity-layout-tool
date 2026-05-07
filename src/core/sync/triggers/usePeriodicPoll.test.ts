// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePeriodicPoll } from './usePeriodicPoll';
import type { SyncAdapters } from '../adapters/types';

const pullNowMock = vi.fn();

vi.mock('../poller', () => ({
  pullNow: (adapters: SyncAdapters) => pullNowMock(adapters),
}));

const noopAdapter = {
  list: vi.fn(),
  get: vi.fn(),
  applyRemote: vi.fn(),
  applyRemoteDelete: vi.fn(),
  subscribe: vi.fn(() => () => {}),
};

const adapters: SyncAdapters = { layouts: noopAdapter, designs: noopAdapter };

function setVisibility(state: 'hidden' | 'visible'): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  pullNowMock.mockReset();
  pullNowMock.mockResolvedValue({ status: 'not-modified' });
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePeriodicPoll', () => {
  it('pulls immediately on mount when the tab is visible', () => {
    renderHook(() => usePeriodicPoll(adapters));
    expect(pullNowMock).toHaveBeenCalledTimes(1);
  });

  it('does not pull on mount when the tab is hidden', () => {
    setVisibility('hidden');
    renderHook(() => usePeriodicPoll(adapters));
    expect(pullNowMock).not.toHaveBeenCalled();
  });

  it('polls every 45 seconds while visible', () => {
    renderHook(() => usePeriodicPoll(adapters));
    expect(pullNowMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(45_000);
    expect(pullNowMock).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(45_000);
    expect(pullNowMock).toHaveBeenCalledTimes(3);
  });

  it('pulls on visibility flip from hidden → visible', () => {
    setVisibility('hidden');
    renderHook(() => usePeriodicPoll(adapters));
    expect(pullNowMock).not.toHaveBeenCalled();

    setVisibility('visible');
    expect(pullNowMock).toHaveBeenCalledTimes(1);
  });

  it('pauses the timer while hidden', () => {
    renderHook(() => usePeriodicPoll(adapters));
    expect(pullNowMock).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    vi.advanceTimersByTime(120_000);
    expect(pullNowMock).toHaveBeenCalledTimes(1);
  });

  it('removes listeners on unmount', () => {
    const { unmount } = renderHook(() => usePeriodicPoll(adapters));
    unmount();
    pullNowMock.mockReset();

    setVisibility('hidden');
    setVisibility('visible');
    vi.advanceTimersByTime(60_000);
    expect(pullNowMock).not.toHaveBeenCalled();
  });
});
