import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
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

  // Two consumers must observe the same snapshot reference until a registry
  // event fires. Previously, mounting a second consumer reloaded the cache
  // inside `subscribe()`, swapping the first consumer's snapshot reference
  // without notifying it — a useSyncExternalStore tearing-contract violation.
  it('keeps already-mounted consumers in sync when another consumer mounts', () => {
    upsertRegistryEntry(makeRef('bin-1'));

    const { result: a } = renderHook(() => useCustomBins());
    const snapshotBefore = a.current;
    expect(snapshotBefore).toHaveLength(1);

    // Second consumer mounts; first consumer's snapshot must not silently change.
    renderHook(() => useCustomBins());
    expect(a.current).toBe(snapshotBefore);
  });

  it('notifies both consumers when the registry updates', () => {
    const { result: a } = renderHook(() => useCustomBins());
    const { result: b } = renderHook(() => useCustomBins());
    expect(a.current).toHaveLength(0);
    expect(b.current).toHaveLength(0);

    act(() => {
      upsertRegistryEntry(makeRef('bin-1'));
    });
    expect(a.current).toHaveLength(1);
    expect(b.current).toHaveLength(1);
    expect(a.current).toBe(b.current);
  });
});
