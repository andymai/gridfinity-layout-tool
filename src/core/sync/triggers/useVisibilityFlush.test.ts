// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVisibilityFlush } from './useVisibilityFlush';

const flushNowMock = vi.fn();

vi.mock('../engine', () => ({
  flushNow: () => flushNowMock(),
}));

beforeEach(() => {
  flushNowMock.mockReset();
});

function setVisibility(state: 'hidden' | 'visible'): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useVisibilityFlush', () => {
  it('flushes when the page transitions to hidden', () => {
    renderHook(() => useVisibilityFlush());
    setVisibility('hidden');
    expect(flushNowMock).toHaveBeenCalledTimes(1);
  });

  it('does not flush when transitioning to visible', () => {
    renderHook(() => useVisibilityFlush());
    setVisibility('visible');
    expect(flushNowMock).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount', () => {
    const { unmount } = renderHook(() => useVisibilityFlush());
    unmount();
    setVisibility('hidden');
    expect(flushNowMock).not.toHaveBeenCalled();
  });
});
