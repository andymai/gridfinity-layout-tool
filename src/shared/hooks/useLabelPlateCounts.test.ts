import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestBin } from '@/test/testUtils';
import { designId } from '@/core/types';
import { ok, err } from '@/core/result';
import type { StorageError } from '@/core/result';
import { useLabelPlateCounts, clearLabelPlateCountCache } from '@/shared/hooks/useLabelPlateCounts';
import {
  binDimensions,
  loadDesign,
  useCustomBins,
  type SavedDesign,
  type CustomBinRef,
  type BinParams,
} from '@/features/bin-designer';

vi.mock('@/features/bin-designer', () => ({
  loadDesign: vi.fn(),
  useCustomBins: vi.fn(() => []),
  binDimensions: vi.fn(() => ({ innerW: 100, innerD: 80 })),
}));

const mockLoadDesign = vi.mocked(loadDesign);
const mockUseCustomBins = vi.mocked(useCustomBins);
const mockBinDimensions = vi.mocked(binDimensions);

const D1 = designId('design-1');

function makeRegistryRef(overrides: Partial<CustomBinRef> = {}): CustomBinRef {
  return {
    id: D1,
    name: 'Socket Design',
    width: 3,
    depth: 2,
    height: 6,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSocketDesign(params: Partial<Record<string, unknown>> = {}): SavedDesign {
  return {
    id: D1,
    name: 'Socket Design',
    params: {
      label: { enabled: true, mode: 'socket', depth: 12 },
      compartments: { cols: 1, rows: 1, cells: [0], thickness: 1.2 },
      // A gridded bin, so no shadow-board sockets to plan. Present because
      // the plate plan reads it: `migrateParams` fills it on every real load.
      cutouts: [],
      ...params,
    } as unknown as BinParams,
    thumbnail: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    exportFileNameConfig: null,
  };
}

describe('useLabelPlateCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLabelPlateCountCache();
    mockUseCustomBins.mockReturnValue([]);
    mockBinDimensions.mockReturnValue({ innerW: 100, innerD: 80 } as unknown as ReturnType<
      typeof binDimensions
    >);
  });

  it('returns an empty map when no bins are linked', () => {
    const { result } = renderHook(() => useLabelPlateCounts([createTestBin()]));

    expect(result.current.size).toBe(0);
    expect(mockLoadDesign).not.toHaveBeenCalled();
  });

  it('resolves the plate set for a socket-mode design', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeSocketDesign()));

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLabelPlateCounts(bins));

    // Single full-width compartment on a 100mm interior: a 2U socket
    // (80.3mm outer) fits, a 3U (122.3mm) does not.
    await waitFor(() =>
      expect(result.current.get(D1)?.plateSet).toEqual({ perBin: 1, widthsU: [2] })
    );
  });

  it('counts one plate per socketed compartment', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(
      ok(makeSocketDesign({ compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 } }))
    );

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLabelPlateCounts(bins));

    await waitFor(() =>
      expect(result.current.get(D1)?.plateSet).toEqual({ perBin: 2, widthsU: [1, 1] })
    );
  });

  // The print list quoted one plate per compartment while the worker
  // cut a socket on each of the compartment's two walls.
  it('counts a plate per edge when tabs sit on both edges', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(
      ok(
        makeSocketDesign({
          label: { enabled: true, mode: 'socket', depth: 12, edges: 'both' },
          compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
        })
      )
    );

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLabelPlateCounts(bins));

    await waitFor(() =>
      expect(result.current.get(D1)?.plateSet).toEqual({ perBin: 4, widthsU: [1, 1, 1, 1] })
    );
  });

  it('omits text-mode designs', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(
      ok(makeSocketDesign({ label: { enabled: true, mode: 'text', depth: 12 } }))
    );

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLabelPlateCounts(bins));

    await waitFor(() => expect(mockLoadDesign).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.get(D1)?.plateSet ?? null).toBeNull());
  });

  it('omits designs that fail to load', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(
      err({ type: 'storage', reason: 'not-found', message: 'gone' } as unknown as StorageError)
    );

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLabelPlateCounts(bins));

    await waitFor(() => expect(mockLoadDesign).toHaveBeenCalledTimes(1));
    expect(result.current.get(D1)?.plateSet ?? null).toBeNull();
  });

  it('serves repeat renders from the cache', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeSocketDesign()));

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const first = renderHook(() => useLabelPlateCounts(bins));
    await waitFor(() => expect(first.result.current.size).toBe(1));
    first.unmount();

    const second = renderHook(() => useLabelPlateCounts(bins));
    expect(second.result.current.size).toBe(1);
    expect(mockLoadDesign).toHaveBeenCalledTimes(1);
  });

  it('reloads when the design updatedAt changes', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeSocketDesign()));

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLabelPlateCounts(bins));
    await waitFor(() => expect(result.current.size).toBe(1));

    mockUseCustomBins.mockReturnValue([makeRegistryRef({ updatedAt: '2026-02-01T00:00:00.000Z' })]);
    const second = renderHook(() => useLabelPlateCounts(bins));
    await waitFor(() => expect(second.result.current.size).toBe(1));
    expect(mockLoadDesign).toHaveBeenCalledTimes(2);
  });

  it('flags a design whose label tabs carry no text at all', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeSocketDesign()));

    const { result } = renderHook(() =>
      useLabelPlateCounts([createTestBin({ linkedDesignId: D1 })])
    );

    // Every tab in the row prints blank — worth knowing before the spool goes
    // in. Design-level, not a per-tab count: counting individual blanks needs
    // the worker's tab plan, and a guess would over-report.
    await waitFor(() => expect(result.current.get(D1)?.tabsWithoutText).toBe(true));
  });

  it('does not flag a design that has text on a tab', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(
      ok(
        makeSocketDesign({
          compartments: { cols: 1, rows: 1, cells: [0], thickness: 1.2, compartmentTexts: ['M3'] },
        })
      )
    );

    const { result } = renderHook(() =>
      useLabelPlateCounts([createTestBin({ linkedDesignId: D1 })])
    );

    await waitFor(() => expect(result.current.get(D1)?.tabsWithoutText).toBe(false));
  });

  it('flags a span design whose rows are blank despite stale compartment captions', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(
      ok(
        makeSocketDesign({
          label: { enabled: true, mode: 'socket', depth: 12, span: true },
          compartments: { cols: 1, rows: 1, cells: [0], thickness: 1.2, compartmentTexts: ['M3'] },
        })
      )
    );

    const { result } = renderHook(() =>
      useLabelPlateCounts([createTestBin({ linkedDesignId: D1 })])
    );

    // Span mode prints `label.rowTexts`, so the leftover compartment caption
    // never reaches a tab. Reading both arrays would call this design labelled.
    await waitFor(() => expect(result.current.get(D1)?.tabsWithoutText).toBe(true));
  });

  it('does not flag a span design that has row text', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(
      ok(
        makeSocketDesign({
          label: { enabled: true, mode: 'socket', depth: 12, span: true, rowTexts: ['DRILL BITS'] },
        })
      )
    );

    const { result } = renderHook(() =>
      useLabelPlateCounts([createTestBin({ linkedDesignId: D1 })])
    );

    await waitFor(() => expect(result.current.get(D1)?.tabsWithoutText).toBe(false));
  });

  it('does not flag a design with no label tabs at all', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(
      ok(makeSocketDesign({ label: { enabled: false, mode: 'socket', depth: 12 } }))
    );

    const { result } = renderHook(() =>
      useLabelPlateCounts([createTestBin({ linkedDesignId: D1 })])
    );

    await waitFor(() => expect(result.current.get(D1)?.tabsWithoutText).toBe(false));
  });
});
