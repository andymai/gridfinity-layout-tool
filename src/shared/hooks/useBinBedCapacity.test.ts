// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLayoutStore } from '@/core/store';
import { designId, gridUnits, mm } from '@/core/types';
import { resetCustomBinsCache } from '@/features/bin-designer/hooks/useCustomBins';
import { upsertRegistryEntry } from '@/features/bin-designer/store/customBinRegistry';
import { useBinBedCapacity } from './useBinBedCapacity';

const DESIGN = designId('long');

function registerDesign(splitToFitBed?: false): void {
  upsertRegistryEntry({
    id: DESIGN,
    name: 'Long',
    width: 8,
    depth: 1,
    height: 3,
    updatedAt: '2026-11-12T00:00:00.000Z',
    ...(splitToFitBed === false ? { splitToFitBed } : {}),
  });
}

const long = { x: gridUnits(0), y: gridUnits(0), width: gridUnits(8), depth: gridUnits(1) };

function capacityOf(bin: Parameters<ReturnType<typeof useBinBedCapacity>>[0]) {
  return renderHook(() => useBinBedCapacity()).result.current(bin);
}

describe('useBinBedCapacity', () => {
  beforeEach(() => {
    localStorage.clear();
    resetCustomBinsCache();
    useLayoutStore.setState((s) => ({
      layout: {
        ...s.layout,
        printBedSize: mm(256),
        printBedDepth: undefined,
        gridUnitMm: mm(42),
      },
    }));
  });

  it('cuts a bin with no design to the bed', () => {
    expect(capacityOf(long)).toEqual({ width: 6, depth: 6 });
  });

  it('cuts a linked bin whose design predates the switch', () => {
    registerDesign();
    expect(capacityOf({ ...long, linkedDesignId: DESIGN })).toEqual({ width: 6, depth: 6 });
  });

  it('keeps a linked bin whole when its design turns splitting off', () => {
    registerDesign(false);
    expect(capacityOf({ ...long, linkedDesignId: DESIGN })).toEqual({
      width: 8,
      depth: 1,
      keptWhole: { width: 6, depth: 6 },
    });
  });

  it('says nothing about a bin of that design that fits', () => {
    registerDesign(false);
    const short = { ...long, width: gridUnits(4), linkedDesignId: DESIGN };
    expect(capacityOf(short).keptWhole).toBeUndefined();
  });
});
