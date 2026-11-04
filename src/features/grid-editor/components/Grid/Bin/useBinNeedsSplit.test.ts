// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLayoutStore } from '@/core/store';
import { gridUnits, mm } from '@/core/types';
import { createTestBin } from '@/test/testUtils';
import { useBinNeedsSplit } from './useBinNeedsSplit';

const needsSplit = (overrides: Parameters<typeof createTestBin>[0]): boolean =>
  renderHook(() => useBinNeedsSplit(createTestBin(overrides))).result.current;

describe('useBinNeedsSplit', () => {
  beforeEach(() => {
    useLayoutStore.setState((s) => ({
      layout: { ...s.layout, printBedSize: mm(256), printBedDepth: undefined },
    }));
  });

  it('flags a bin too big for the bed at any angle', () => {
    expect(needsSplit({ width: gridUnits(8), depth: gridUnits(4) })).toBe(true);
  });

  it('leaves a long bin that fits lying diagonally alone', () => {
    expect(needsSplit({ width: gridUnits(1.5), depth: gridUnits(7) })).toBe(false);
  });

  it('flags that long bin once an overhang pushes it past the diagonal', () => {
    const overhang = { left: 0, right: 0, front: 10, back: 10, enabled: true };
    expect(needsSplit({ width: gridUnits(1.5), depth: gridUnits(7), overhang })).toBe(true);
  });
});
