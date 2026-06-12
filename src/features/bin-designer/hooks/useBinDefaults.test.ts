// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBinDefaults } from './useBinDefaults';
import { useBinDefaultsStore } from '../store/binDefaults';
import { hasCustomDefault } from '../storage/defaultParamsStorage';
import { useToastStore } from '@/core/store/toast';

describe('useBinDefaults', () => {
  beforeEach(() => {
    localStorage.clear();
    useBinDefaultsStore.setState({ hasCustomDefault: false });
    useToastStore.setState({ toasts: [] });
  });

  it('setCurrentAsDefault persists, flips the flag, and toasts success', () => {
    const { result } = renderHook(() => useBinDefaults());
    act(() => result.current.setCurrentAsDefault());

    expect(hasCustomDefault()).toBe(true);
    expect(useBinDefaultsStore.getState().hasCustomDefault).toBe(true);
    const toasts = useToastStore.getState().toasts;
    expect(toasts.at(-1)?.type).toBe('success');
  });

  it('resetToFactory clears the default and toasts success when one was set', () => {
    const { result } = renderHook(() => useBinDefaults());
    act(() => result.current.setCurrentAsDefault());
    useToastStore.setState({ toasts: [] });

    act(() => result.current.resetToFactory());

    expect(hasCustomDefault()).toBe(false);
    expect(useBinDefaultsStore.getState().hasCustomDefault).toBe(false);
    expect(useToastStore.getState().toasts.at(-1)?.type).toBe('success');
  });

  it('resetToFactory is a no-op info toast when no custom default exists', () => {
    const { result } = renderHook(() => useBinDefaults());
    act(() => result.current.resetToFactory());

    expect(hasCustomDefault()).toBe(false);
    expect(useToastStore.getState().toasts.at(-1)?.type).toBe('info');
  });
});
