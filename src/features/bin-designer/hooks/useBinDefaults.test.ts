// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBinDefaults } from './useBinDefaults';
import { useBinDefaultsStore } from '../store/binDefaults';
import { hasCustomDefault } from '../storage/defaultParamsStorage';
import { useToastStore } from '@/core/store/toast';
import { resetAllStores } from '@/test/testUtils';

describe('useBinDefaults', () => {
  beforeEach(() => {
    // resetAllStores() resets the shared stores (incl. toast). binDefaults and
    // localStorage are reset explicitly since it does not cover them. Assertions
    // here check default presence (a boolean), not specific captured params, so
    // the designer store's params (not reset by resetAllStores) don't matter.
    resetAllStores();
    localStorage.clear();
    useBinDefaultsStore.setState({ hasCustomDefault: false });
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
