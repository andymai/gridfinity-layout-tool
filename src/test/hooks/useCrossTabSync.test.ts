import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCrossTabSync } from '../../hooks/useCrossTabSync';
import { useToastStore } from '../../store/toast';

describe('useCrossTabSync', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows toast when library storage key changes', () => {
    renderHook(() => useCrossTabSync());

    // Simulate storage event from another tab
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'gridfinity-library-v1',
        newValue: '{}',
        oldValue: null,
      }));
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toContain('modified in another tab');
  });

  it('shows toast when layout storage key changes', () => {
    renderHook(() => useCrossTabSync());

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'gridfinity-layout-abc123',
        newValue: '{}',
        oldValue: null,
      }));
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toContain('modified in another tab');
  });

  it('ignores storage events for unrelated keys', () => {
    renderHook(() => useCrossTabSync());

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'some-other-app-key',
        newValue: '{}',
        oldValue: null,
      }));
    });

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('only shows warning once per session', () => {
    renderHook(() => useCrossTabSync());

    // First storage event
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'gridfinity-library-v1',
        newValue: '{}',
        oldValue: null,
      }));
    });

    // Second storage event
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'gridfinity-layout-xyz',
        newValue: '{}',
        oldValue: null,
      }));
    });

    // Should still only have one toast
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('removes event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useCrossTabSync());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
  });

  it('toast has info type', () => {
    renderHook(() => useCrossTabSync());

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'gridfinity-library-v1',
        newValue: '{}',
        oldValue: null,
      }));
    });

    expect(useToastStore.getState().toasts[0].type).toBe('info');
  });
});
