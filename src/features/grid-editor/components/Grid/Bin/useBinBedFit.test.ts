// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLayoutStore } from '@/core/store';
import { designId, gridUnits, mm } from '@/core/types';
import { resetCustomBinsCache } from '@/features/bin-designer/hooks/useCustomBins';
import { upsertRegistryEntry } from '@/features/bin-designer/store/customBinRegistry';
import { createTestBin } from '@/test/testUtils';
import { useBinBedFit } from './useBinBedFit';

const bedFit = (overrides: Parameters<typeof createTestBin>[0]) =>
  renderHook(() => useBinBedFit(createTestBin(overrides))).result.current;

describe('useBinBedFit', () => {
  beforeEach(() => {
    localStorage.clear();
    resetCustomBinsCache();
    useLayoutStore.setState((s) => ({
      layout: { ...s.layout, printBedSize: mm(256), printBedDepth: undefined },
    }));
  });

  it('flags a bin too big for the bed at any angle', () => {
    expect(bedFit({ width: gridUnits(8), depth: gridUnits(4) })).toBe('split');
  });

  it('leaves a long bin that fits lying diagonally alone', () => {
    expect(bedFit({ width: gridUnits(1.5), depth: gridUnits(7) })).toBe('fits');
  });

  it('flags that long bin once an overhang pushes it past the diagonal', () => {
    const overhang = { left: 0, right: 0, front: 10, back: 10, enabled: true };
    expect(bedFit({ width: gridUnits(1.5), depth: gridUnits(7), overhang })).toBe('split');
  });

  it('marks a bin kept whole when its design turns splitting off', () => {
    const id = designId('long');
    upsertRegistryEntry({
      id,
      name: 'Long',
      width: 8,
      depth: 4,
      height: 3,
      splitToFitBed: false,
      updatedAt: '2026-11-12T00:00:00.000Z',
    });
    expect(bedFit({ width: gridUnits(8), depth: gridUnits(4), linkedDesignId: id })).toBe(
      'keptWhole'
    );
  });
});
