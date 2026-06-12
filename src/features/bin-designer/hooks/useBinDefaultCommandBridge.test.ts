// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBinDefaultCommandBridge } from './useBinDefaultCommandBridge';
import { useBinDefaultsStore } from '../store/binDefaults';
import { hasCustomDefault } from '../storage/defaultParamsStorage';
import { useToastStore } from '@/core/store/toast';

describe('useBinDefaultCommandBridge', () => {
  beforeEach(() => {
    localStorage.clear();
    useBinDefaultsStore.setState({ hasCustomDefault: false });
    useToastStore.setState({ toasts: [] });
  });

  it('saves the default when the set-default window event fires', () => {
    renderHook(() => useBinDefaultCommandBridge());
    act(() => window.dispatchEvent(new CustomEvent('bin-designer:set-default')));

    expect(hasCustomDefault()).toBe(true);
    expect(useBinDefaultsStore.getState().hasCustomDefault).toBe(true);
  });

  it('clears the default when the reset-default window event fires', () => {
    renderHook(() => useBinDefaultCommandBridge());
    act(() => window.dispatchEvent(new CustomEvent('bin-designer:set-default')));
    act(() => window.dispatchEvent(new CustomEvent('bin-designer:reset-default')));

    expect(hasCustomDefault()).toBe(false);
    expect(useBinDefaultsStore.getState().hasCustomDefault).toBe(false);
  });

  it('removes listeners on unmount', () => {
    const { unmount } = renderHook(() => useBinDefaultCommandBridge());
    unmount();
    act(() => window.dispatchEvent(new CustomEvent('bin-designer:set-default')));

    expect(hasCustomDefault()).toBe(false);
  });
});
