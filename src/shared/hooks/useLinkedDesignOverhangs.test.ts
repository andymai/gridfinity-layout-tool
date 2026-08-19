// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { designId } from '@/core/types';
import { resetCustomBinsCache } from '@/features/bin-designer/hooks/useCustomBins';
import {
  registryOverhangFields,
  upsertRegistryEntry,
  type CustomBinRef,
} from '@/features/bin-designer/store/customBinRegistry';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { binSplitChunkUnits } from '@/shared/utils/binSplitFit';
import { useLinkedDesignOverhangs } from './useLinkedDesignOverhangs';

function makeRef(id: string, overhangMm?: CustomBinRef['overhangMm']): CustomBinRef {
  return {
    id: designId(id),
    name: id,
    width: 4,
    depth: 4,
    height: 3,
    updatedAt: '2026-08-19T00:00:00.000Z',
    ...(overhangMm ? { overhangMm } : {}),
  };
}

describe('useLinkedDesignOverhangs', () => {
  beforeEach(() => {
    localStorage.clear();
    resetCustomBinsCache();
  });

  it('is empty when nothing is registered', () => {
    const { result } = renderHook(() => useLinkedDesignOverhangs());
    expect(result.current.size).toBe(0);
  });

  it('reads a design overhang off the registry as an enabled config', () => {
    upsertRegistryEntry(makeRef('d1', { left: 61.5, right: 42, front: 0, back: 0 }));

    const { result } = renderHook(() => useLinkedDesignOverhangs());
    expect(result.current.get(designId('d1'))).toEqual({
      left: 61.5,
      right: 42,
      front: 0,
      back: 0,
      enabled: true,
    });
  });

  // Absent means nothing to charge, whether the design has no overhang or the
  // entry predates the field. Both read the same on purpose.
  it('omits designs with no stored overhang', () => {
    upsertRegistryEntry(makeRef('d1'));
    upsertRegistryEntry(makeRef('d2', { left: 10, right: 0, front: 0, back: 0 }));

    const { result } = renderHook(() => useLinkedDesignOverhangs());
    expect(result.current.has(designId('d1'))).toBe(false);
    expect(result.current.has(designId('d2'))).toBe(true);
  });

  // The whole chain the registry field exists for: a design saved with an
  // overhang, read back synchronously, and charged against the print bed —
  // without ever loading full params out of IndexedDB.
  it('carries a saved design overhang through to the split limit', () => {
    upsertRegistryEntry({
      ...makeRef('d1'),
      ...registryOverhangFields({
        ...DEFAULT_BIN_PARAMS,
        overhang: { left: 61.5, right: 42, front: 0, back: 0, enabled: true },
      }),
    });

    const { result } = renderHook(() => useLinkedDesignOverhangs());
    const overhang = result.current.get(designId('d1'));

    // 4 x 42mm is 168mm of grid, inside a 180mm bed; the overhang makes the real
    // part 271.5mm wide.
    const limit = binSplitChunkUnits({ width: 4, depth: 4, gridUnitMm: 42, overhang }, 180);
    expect(4 > limit.width).toBe(true);
    expect(4 > limit.depth).toBe(false);
  });

  it('leaves the limit alone for a design saved without one', () => {
    upsertRegistryEntry({ ...makeRef('d1'), ...registryOverhangFields(DEFAULT_BIN_PARAMS) });

    const { result } = renderHook(() => useLinkedDesignOverhangs());
    const limit = binSplitChunkUnits(
      { width: 4, depth: 4, gridUnitMm: 42, overhang: result.current.get(designId('d1')) },
      180
    );
    expect(4 > limit.width).toBe(false);
  });
});
