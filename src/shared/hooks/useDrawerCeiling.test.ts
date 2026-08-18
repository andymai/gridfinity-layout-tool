import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLayoutStore } from '@/core/store/layout';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { binId, designId, heightUnits, layerId } from '@/core/types';
import { useCustomBins, type CustomBinRef } from '@/features/bin-designer';
import { useDrawerCeiling } from './useDrawerCeiling';
import { LIP_PROTRUSION_MM } from '@/shared/utils/heightUnits';

vi.mock('@/features/bin-designer', () => ({
  useCustomBins: vi.fn(() => []),
}));

const LINKED = designId('design-1');

function ref(overrides: Partial<CustomBinRef> = {}): CustomBinRef {
  return {
    id: LINKED,
    name: 'Linked',
    width: 1,
    depth: 1,
    height: 3,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function seed(measuredHeightMm: number | undefined, linkedDesignId?: typeof LINKED): void {
  const layout = createTestLayout({
    drawer: {
      ...createTestLayout().drawer,
      ...(measuredHeightMm === undefined
        ? {}
        : { measuredMm: { width: 420, depth: 336, height: measuredHeightMm } }),
    },
    bins: [
      createTestBin({
        id: binId('b1'),
        layerId: layerId('layer1'),
        height: heightUnits(6),
        ...(linkedDesignId ? { linkedDesignId } : {}),
      }),
    ],
  });
  useLayoutStore.setState({ layout });
}

describe('useDrawerCeiling', () => {
  beforeEach(() => {
    vi.mocked(useCustomBins).mockReturnValue([]);
  });

  it('returns null until the drawer height is measured', () => {
    seed(undefined);
    expect(renderHook(() => useDrawerCeiling()).result.current).toBeNull();
  });

  it('measures a plain bin at its printed height', () => {
    seed(100);
    const fit = renderHook(() => useDrawerCeiling()).result.current;
    expect(fit?.tallestMm).toBeCloseTo(6 * 7 + LIP_PROTRUSION_MM, 5);
    expect(fit?.fits).toBe(true);
  });

  it('measures a linked bin through the design rise on its registry entry', () => {
    vi.mocked(useCustomBins).mockReturnValue([ref({ assembledRiseMm: 80 })]);
    seed(100, LINKED);
    expect(renderHook(() => useDrawerCeiling()).result.current?.tallestMm).toBeCloseTo(80, 5);
  });

  // A design saved before the field existed, or an imported mesh with no params
  // to derive one from, must not read as a zero-height bin.
  it('falls back to the plain-bin height when the entry carries no rise', () => {
    vi.mocked(useCustomBins).mockReturnValue([ref()]);
    seed(100, LINKED);
    expect(renderHook(() => useDrawerCeiling()).result.current?.tallestMm).toBeCloseTo(
      6 * 7 + LIP_PROTRUSION_MM,
      5
    );
  });

  it('flags the overflow when the linked design stands proud', () => {
    vi.mocked(useCustomBins).mockReturnValue([ref({ assembledRiseMm: 80 })]);
    seed(60, LINKED);
    const fit = renderHook(() => useDrawerCeiling()).result.current;
    expect(fit?.fits).toBe(false);
    expect(fit?.overflowing[0]?.overflowMm).toBeCloseTo(20, 5);
  });
});
