// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useRetryOnReconnect } from './useRetryOnReconnect';

function goOnline(): void {
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
}

describe('useRetryOnReconnect', () => {
  it('starts at zero', () => {
    const { result } = renderHook(() => useRetryOnReconnect(false));
    expect(result.current).toBe(0);
  });

  it('ignores reconnects while nothing has failed', () => {
    const { result } = renderHook(() => useRetryOnReconnect(false));
    goOnline();
    expect(result.current).toBe(0);
  });

  it('increments on reconnect once something has failed', () => {
    const { result } = renderHook(({ failed }) => useRetryOnReconnect(failed), {
      initialProps: { failed: true },
    });
    goOnline();
    expect(result.current).toBe(1);
  });

  it('counts each reconnect so a repeatedly failing load keeps retrying', () => {
    const { result } = renderHook(() => useRetryOnReconnect(true));
    goOnline();
    goOnline();
    expect(result.current).toBe(2);
  });

  it('stops listening once the failure clears', () => {
    const { result, rerender } = renderHook(({ failed }) => useRetryOnReconnect(failed), {
      initialProps: { failed: true },
    });
    goOnline();
    expect(result.current).toBe(1);

    rerender({ failed: false });
    goOnline();
    expect(result.current).toBe(1);
  });

  it('detaches its listener on unmount', () => {
    const { result, unmount } = renderHook(() => useRetryOnReconnect(true));
    unmount();
    goOnline();
    expect(result.current).toBe(0);
  });
});
