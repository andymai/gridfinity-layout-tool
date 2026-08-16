import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { useBaseplatePageStore } from '../store/baseplatePageStore';
import { useBaseplateExport } from './useBaseplateExport';
import type { BaseplateTiling } from '../types/tiling';

vi.mock('@/shared/generation/bridge', () => ({
  getActiveBridge: () => ({}),
  workerPoolManager: { get: () => null },
}));

const tiling = (bedOverages: BaseplateTiling['bedOverages']): BaseplateTiling => ({
  isSplit: true,
  pieces: [],
  margins: [],
  cols: 2,
  rows: 1,
  colSizes: [6, 6],
  rowSizes: [4],
  totalWidthUnits: 12,
  totalDepthUnits: 4,
  bedLoads: 2,
  stackCount: 1,
  stackSeparatorThickness: 0,
  paddingReductionHint: null,
  isCustomSplit: true,
  bedOverages,
});

describe('useBaseplateExport', () => {
  beforeEach(() => {
    resetAllStores();
    useBaseplatePageStore.setState({
      generation: {
        ...useBaseplatePageStore.getState().generation,
        mesh: { vertices: new Float32Array([0]), error: null } as never,
      },
    });
  });

  it('is defined', () => {
    expect(useBaseplateExport).toBeDefined();
  });

  it('allows export when every piece fits the bed', () => {
    useBaseplatePageStore.getState().setTiling(tiling([]));
    const { result } = renderHook(() => useBaseplateExport());
    expect(result.current.canExport).toBe(true);
  });

  // A user-drawn seam can leave a piece larger than the bed. The preview
  // keeps rendering it (mid-edit feedback is the point) but exporting would ship
  // an STL the slicer refuses, so the button goes dead until the plan is fixed.
  it('blocks export while any piece exceeds the bed', () => {
    useBaseplatePageStore
      .getState()
      .setTiling(tiling([{ label: 'A1', overWidthMm: 80, overDepthMm: 0 }]));
    const { result } = renderHook(() => useBaseplateExport());
    expect(result.current.canExport).toBe(false);
  });
});
