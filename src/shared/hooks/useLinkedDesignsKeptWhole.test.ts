// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { designId } from '@/core/types';
import { resetCustomBinsCache } from '@/features/bin-designer/hooks/useCustomBins';
import {
  upsertRegistryEntry,
  type CustomBinRef,
} from '@/features/bin-designer/store/customBinRegistry';
import { useLinkedDesignsKeptWhole } from './useLinkedDesignsKeptWhole';

function makeRef(id: string, splitToFitBed?: false): CustomBinRef {
  return {
    id: designId(id),
    name: id,
    width: 8,
    depth: 1,
    height: 3,
    updatedAt: '2026-11-12T00:00:00.000Z',
    ...(splitToFitBed === false ? { splitToFitBed } : {}),
  };
}

describe('useLinkedDesignsKeptWhole', () => {
  beforeEach(() => {
    localStorage.clear();
    resetCustomBinsCache();
  });

  it('lists only the designs that turn splitting off', () => {
    upsertRegistryEntry(makeRef('whole', false));
    upsertRegistryEntry(makeRef('splits'));

    const { result } = renderHook(() => useLinkedDesignsKeptWhole());
    expect([...result.current]).toEqual([designId('whole')]);
  });

  it('keeps the switch through a rename that omits it', () => {
    upsertRegistryEntry(makeRef('whole', false));
    upsertRegistryEntry({ ...makeRef('whole'), name: 'Renamed' });

    const { result } = renderHook(() => useLinkedDesignsKeptWhole());
    expect(result.current.has(designId('whole'))).toBe(true);
  });
});
