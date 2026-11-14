import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBeforeUnloadGuard } from './useBeforeUnloadGuard';

function unloadIsBlocked(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('useBeforeUnloadGuard', () => {
  it('does not block unload while inactive', () => {
    renderHook(() => useBeforeUnloadGuard(false));
    expect(unloadIsBlocked()).toBe(false);
  });

  it('blocks unload while active', () => {
    renderHook(() => useBeforeUnloadGuard(true));
    expect(unloadIsBlocked()).toBe(true);
  });

  it('follows the active flag as it changes', () => {
    const { rerender } = renderHook(({ active }) => useBeforeUnloadGuard(active), {
      initialProps: { active: false },
    });
    expect(unloadIsBlocked()).toBe(false);

    rerender({ active: true });
    expect(unloadIsBlocked()).toBe(true);

    rerender({ active: false });
    expect(unloadIsBlocked()).toBe(false);
  });

  it('stops blocking unload after unmount', () => {
    const { unmount } = renderHook(() => useBeforeUnloadGuard(true));
    unmount();
    expect(unloadIsBlocked()).toBe(false);
  });
});
