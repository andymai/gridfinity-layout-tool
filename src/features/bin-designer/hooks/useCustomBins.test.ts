import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCustomBins, resetCustomBinsCache } from './useCustomBins';
import { upsertRegistryEntry, type CustomBinRef } from '../store/customBinRegistry';

function makeRef(id: string, name: string = 'Test Bin'): CustomBinRef {
  return {
    id,
    name,
    width: 2,
    depth: 3,
    height: 4,
    updatedAt: '2026-01-22T00:00:00.000Z',
  };
}

describe('useCustomBins', () => {
  beforeEach(() => {
    localStorage.clear();
    resetCustomBinsCache(); // Reset module-level cache after clearing storage
  });

  it('returns empty array when no custom bins saved', () => {
    const { result } = renderHook(() => useCustomBins());
    expect(result.current).toEqual([]);
  });

  it('returns saved custom bins from registry', () => {
    upsertRegistryEntry(makeRef('bin-1', 'My Bin'));
    upsertRegistryEntry(makeRef('bin-2', 'Other Bin'));

    const { result } = renderHook(() => useCustomBins());
    expect(result.current).toHaveLength(2);
    expect(result.current[0].name).toBe('My Bin');
    expect(result.current[1].name).toBe('Other Bin');
  });

  it('reads fresh data on re-mount', () => {
    upsertRegistryEntry(makeRef('bin-1'));

    const { result, unmount } = renderHook(() => useCustomBins());
    expect(result.current).toHaveLength(1);
    unmount();

    // Simulate designer saving a new design while planner is unmounted
    upsertRegistryEntry(makeRef('bin-2'));

    const { result: result2 } = renderHook(() => useCustomBins());
    expect(result2.current).toHaveLength(2);
  });

  it('includes dimensions in each ref', () => {
    const ref: CustomBinRef = {
      id: 'custom-1',
      name: 'Wide Bin',
      width: 4,
      depth: 2,
      height: 6,
      updatedAt: '2026-01-22T12:00:00.000Z',
    };
    upsertRegistryEntry(ref);

    const { result } = renderHook(() => useCustomBins());
    expect(result.current[0]).toEqual(ref);
  });
});
