// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { designId } from '@/core/types';
import { resetCustomBinsCache } from '@/features/bin-designer/hooks/useCustomBins';
import {
  upsertRegistryEntry,
  type CustomBinRef,
} from '@/features/bin-designer/store/customBinRegistry';
import { useLinkedDesignKinds } from './useLinkedDesignKinds';

function makeRef(id: string, kind?: CustomBinRef['kind']): CustomBinRef {
  return {
    id: designId(id),
    name: id,
    width: 1,
    depth: 1,
    height: 3,
    updatedAt: '2026-10-07T00:00:00.000Z',
    ...(kind ? { kind } : {}),
  };
}

describe('useLinkedDesignKinds', () => {
  beforeEach(() => {
    localStorage.clear();
    resetCustomBinsCache();
  });

  it('is empty when nothing is registered', () => {
    const { result } = renderHook(() => useLinkedDesignKinds());
    expect(result.current.size).toBe(0);
  });

  it('reads each design kind off the registry', () => {
    upsertRegistryEntry(makeRef('mesh', 'importedMesh'));
    upsertRegistryEntry(makeRef('holder', 'assembly'));
    upsertRegistryEntry(makeRef('bin', 'bin'));

    const { result } = renderHook(() => useLinkedDesignKinds());
    expect(result.current.get(designId('mesh'))).toBe('importedMesh');
    expect(result.current.get(designId('holder'))).toBe('assembly');
    expect(result.current.get(designId('bin'))).toBe('bin');
  });

  // An entry with no kind is a parametric bin by the registry's convention, so
  // it reads the same as a design that was never registered.
  it('omits entries that record no kind', () => {
    upsertRegistryEntry(makeRef('legacy'));

    const { result } = renderHook(() => useLinkedDesignKinds());
    expect(result.current.has(designId('legacy'))).toBe(false);
  });

  it('still reads an assembly after a rename that omits the kind', () => {
    upsertRegistryEntry(makeRef('holder', 'assembly'));
    upsertRegistryEntry({ ...makeRef('holder'), name: 'Renamed holder' });

    const { result } = renderHook(() => useLinkedDesignKinds());
    expect(result.current.get(designId('holder'))).toBe('assembly');
  });

  // One projection per registry snapshot: the 2D grid mounts this once per bin.
  it('hands every caller the same map for the same registry snapshot', () => {
    upsertRegistryEntry(makeRef('mesh', 'importedMesh'));

    const { result } = renderHook(() => [useLinkedDesignKinds(), useLinkedDesignKinds()]);
    const [first, second] = result.current;
    expect(first).toBe(second);
  });

  it('picks up a design registered after mount', () => {
    const { result } = renderHook(() => useLinkedDesignKinds());
    expect(result.current.has(designId('mesh'))).toBe(false);

    act(() => {
      upsertRegistryEntry(makeRef('mesh', 'importedMesh'));
    });
    expect(result.current.get(designId('mesh'))).toBe('importedMesh');
  });
});
