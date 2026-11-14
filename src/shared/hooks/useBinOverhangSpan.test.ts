// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { calcBedCapacityForBin } from '@/core/constants';
import { designId, gridUnits } from '@/core/types';
import { resetCustomBinsCache } from '@/features/bin-designer/hooks/useCustomBins';
import {
  upsertRegistryEntry,
  type CustomBinRef,
} from '@/features/bin-designer/store/customBinRegistry';
import { useBinOverhangSpan } from './useBinOverhangSpan';

const DESIGN = designId('long');
const SIDES = { left: 0, right: 0, front: 10, back: 10 };

function registerDesign(overhangMm?: CustomBinRef['overhangMm']): void {
  upsertRegistryEntry({
    id: DESIGN,
    name: 'Long',
    width: 1.5,
    depth: 7,
    height: 3,
    updatedAt: '2026-11-04T00:00:00.000Z',
    ...(overhangMm ? { overhangMm } : {}),
  });
}

const long = { x: gridUnits(0), y: gridUnits(0), width: gridUnits(1.5), depth: gridUnits(7) };

describe('useBinOverhangSpan', () => {
  beforeEach(() => {
    localStorage.clear();
    resetCustomBinsCache();
  });

  it('is zero for a bin with no overhang', () => {
    const { result } = renderHook(() => useBinOverhangSpan());
    expect(result.current(long)).toEqual({ width: 0, depth: 0 });
  });

  it('reads a placement overhang', () => {
    const { result } = renderHook(() => useBinOverhangSpan());
    expect(result.current({ ...long, overhang: { ...SIDES, enabled: true } })).toEqual({
      width: 0,
      depth: 20,
    });
  });

  it('falls back to the linked design, as the print list does', () => {
    registerDesign(SIDES);
    const { result } = renderHook(() => useBinOverhangSpan());
    expect(result.current({ ...long, linkedDesignId: DESIGN })).toEqual({ width: 0, depth: 20 });
  });

  it('lets a placement overhang replace the design one rather than add to it', () => {
    registerDesign(SIDES);
    const { result } = renderHook(() => useBinOverhangSpan());
    const placed = { left: 3, right: 0, front: 0, back: 0, enabled: true };
    expect(result.current({ ...long, linkedDesignId: DESIGN, overhang: placed })).toEqual({
      width: 3,
      depth: 0,
    });
  });

  it('keeps a bin split that its overhang pushes past the diagonal', () => {
    registerDesign(SIDES);
    const { result } = renderHook(() => useBinOverhangSpan());
    const span = result.current({ ...long, linkedDesignId: DESIGN });
    expect(calcBedCapacityForBin(1.5, 7, 256, 42, 256, 42, span).diagonal).toBeUndefined();
  });
});
