import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useCutoutQuickstart } from './useCutoutQuickstart';

const QUICKSTART_KEY = 'gridfinity-cutout-quickstart-seen';

describe('useCutoutQuickstart', () => {
  beforeEach(() => {
    localStorage.removeItem(QUICKSTART_KEY);
  });

  it('returns false when localStorage key is absent', () => {
    const { result } = renderHook(() => useCutoutQuickstart());
    expect(result.current.quickstartSeen).toBe(false);
  });

  it('returns true after markQuickstartSeen is called', () => {
    const { result } = renderHook(() => useCutoutQuickstart());

    act(() => {
      result.current.markQuickstartSeen();
    });

    expect(result.current.quickstartSeen).toBe(true);
    expect(localStorage.getItem(QUICKSTART_KEY)).toBe('true');
  });

  it('returns true when localStorage key is already set', () => {
    localStorage.setItem(QUICKSTART_KEY, 'true');
    const { result } = renderHook(() => useCutoutQuickstart());
    expect(result.current.quickstartSeen).toBe(true);
  });
});
