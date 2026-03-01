import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToastStore } from '@/core/store/toast';
import { showErrorToast, useResultToast } from './useResultToast';
import {
  apiRateLimited,
  apiServerError,
  storageQuotaExceeded,
  layoutLayerLimit,
} from '@/core/result';

describe('showErrorToast', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('creates a toast with the user message', () => {
    showErrorToast(apiServerError());

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toContain('Server error');
  });

  it('includes recovery hint when available', () => {
    showErrorToast(storageQuotaExceeded());

    const toasts = useToastStore.getState().toasts;
    expect(toasts[0].message).toContain('Export layouts');
  });

  it('maps warning severity to info toast type', () => {
    showErrorToast(layoutLayerLimit(10, 10));

    const toasts = useToastStore.getState().toasts;
    expect(toasts[0].type).toBe('info');
  });

  it('maps error severity to error toast type', () => {
    showErrorToast(apiServerError());

    const toasts = useToastStore.getState().toasts;
    expect(toasts[0].type).toBe('error');
  });

  it('interpolates metadata into recovery hint', () => {
    showErrorToast(apiRateLimited(60));

    const toasts = useToastStore.getState().toasts;
    expect(toasts[0].message).toContain('60');
  });
});

describe('useResultToast', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('provides showErrorToast function via hook', () => {
    const { result } = renderHook(() => useResultToast());

    act(() => {
      result.current.showErrorToast(apiServerError());
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toContain('Server error');
  });

  it('includes recovery hint via hook', () => {
    const { result } = renderHook(() => useResultToast());

    act(() => {
      result.current.showErrorToast(storageQuotaExceeded());
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts[0].message).toContain('Export layouts');
  });
});
