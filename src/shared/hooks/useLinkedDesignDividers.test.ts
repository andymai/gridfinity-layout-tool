import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestBin } from '@/test/testUtils';
import { designId } from '@/core/types';
import { ok, err } from '@/core/result';
import type { StorageError } from '@/core/result';
import {
  useLinkedDesignDividers,
  clearLinkedDesignDividerCache,
} from '@/shared/hooks/useLinkedDesignDividers';
import {
  loadDesign,
  useCustomBins,
  deriveWallSegments,
  type SavedDesign,
  type CustomBinRef,
  type BinParams,
} from '@/features/bin-designer';

vi.mock('@/features/bin-designer', () => ({
  loadDesign: vi.fn(),
  useCustomBins: vi.fn(() => []),
  deriveWallSegments: vi.fn(() => []),
}));

const mockLoadDesign = vi.mocked(loadDesign);
const mockUseCustomBins = vi.mocked(useCustomBins);
const mockDeriveWallSegments = vi.mocked(deriveWallSegments);

const GRID_UNIT_MM = 42;
const D1 = designId('design-1');

function makeRegistryRef(overrides: Partial<CustomBinRef> = {}): CustomBinRef {
  return {
    id: D1,
    name: 'Test Design',
    width: 2,
    depth: 1,
    height: 6,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSavedDesign(compartmentOverrides: Record<string, unknown> = {}): SavedDesign {
  return {
    id: D1,
    name: 'Test Design',
    params: {
      compartments: {
        cols: 2,
        rows: 1,
        thickness: 1.2,
        cells: [0, 1],
        ...compartmentOverrides,
      },
    } as unknown as BinParams,
    thumbnail: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    exportFileNameConfig: null,
  };
}

const VERTICAL_SEGMENT = { x: 0.5, y: 0, length: 1, orientation: 'vertical' as const };

describe('useLinkedDesignDividers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLinkedDesignDividerCache();
    mockUseCustomBins.mockReturnValue([]);
    mockDeriveWallSegments.mockReturnValue([]);
  });

  it('returns an empty map when no bins are linked', () => {
    const bins = [createTestBin()];
    const { result } = renderHook(() => useLinkedDesignDividers(bins, GRID_UNIT_MM));

    expect(result.current.size).toBe(0);
    expect(mockLoadDesign).not.toHaveBeenCalled();
  });

  it('does not load designs missing from the registry (deleted designs)', () => {
    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignDividers(bins, GRID_UNIT_MM));

    expect(result.current.size).toBe(0);
    expect(mockLoadDesign).not.toHaveBeenCalled();
  });

  it('resolves divider specs for linked bins', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeSavedDesign()));
    mockDeriveWallSegments.mockReturnValue([VERTICAL_SEGMENT]);

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignDividers(bins, GRID_UNIT_MM));

    await waitFor(() => {
      expect(result.current.get(D1)).toBeDefined();
    });

    const spec = result.current.get(D1);
    expect(spec?.segments).toEqual([VERTICAL_SEGMENT]);
    expect(spec?.thickness).toBeCloseTo(1.2 / GRID_UNIT_MM, 5);
    expect(spec?.height).toBeNull();
    expect(spec?.sig).toContain('2026-01-01T00:00:00.000Z');
    expect(mockLoadDesign).toHaveBeenCalledTimes(1);
  });

  it('converts a numeric dividerHeight from mm to grid units', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeSavedDesign({ dividerHeight: 21 })));
    mockDeriveWallSegments.mockReturnValue([VERTICAL_SEGMENT]);

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignDividers(bins, GRID_UNIT_MM));

    await waitFor(() => {
      expect(result.current.get(D1)?.height).toBeCloseTo(0.5, 5);
    });
  });

  it('omits designs with no divider segments (single compartment)', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeSavedDesign({ cols: 1, rows: 1, cells: [0] })));
    mockDeriveWallSegments.mockReturnValue([]);

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignDividers(bins, GRID_UNIT_MM));

    await waitFor(() => {
      expect(mockLoadDesign).toHaveBeenCalledTimes(1);
    });
    expect(result.current.size).toBe(0);
  });

  it('omits designs whose load fails, without retry storms', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(
      err({ type: 'not_found', message: 'gone' } as unknown as StorageError)
    );

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result, rerender } = renderHook(() => useLinkedDesignDividers(bins, GRID_UNIT_MM));

    await waitFor(() => {
      expect(mockLoadDesign).toHaveBeenCalledTimes(1);
    });
    expect(result.current.size).toBe(0);

    // Failure is cached by id:updatedAt — re-render does not reload
    rerender();
    expect(mockLoadDesign).toHaveBeenCalledTimes(1);
  });

  it('caches loaded specs across mounts', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeSavedDesign()));
    mockDeriveWallSegments.mockReturnValue([VERTICAL_SEGMENT]);

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const first = renderHook(() => useLinkedDesignDividers(bins, GRID_UNIT_MM));
    await waitFor(() => {
      expect(first.result.current.get(D1)).toBeDefined();
    });
    first.unmount();

    const second = renderHook(() => useLinkedDesignDividers(bins, GRID_UNIT_MM));
    // Cached spec is available synchronously on the second mount
    expect(second.result.current.get(D1)).toBeDefined();
    expect(mockLoadDesign).toHaveBeenCalledTimes(1);
  });

  it('reloads when the design updatedAt changes (design edited)', async () => {
    mockUseCustomBins.mockReturnValue([makeRegistryRef()]);
    mockLoadDesign.mockResolvedValue(ok(makeSavedDesign()));
    mockDeriveWallSegments.mockReturnValue([VERTICAL_SEGMENT]);

    const bins = [createTestBin({ linkedDesignId: D1 })];
    const { result } = renderHook(() => useLinkedDesignDividers(bins, GRID_UNIT_MM));
    await waitFor(() => {
      expect(result.current.get(D1)).toBeDefined();
    });

    mockUseCustomBins.mockReturnValue([makeRegistryRef({ updatedAt: '2026-02-02T00:00:00.000Z' })]);
    const updated = renderHook(() => useLinkedDesignDividers(bins, GRID_UNIT_MM));
    await waitFor(() => {
      expect(updated.result.current.get(D1)?.sig).toContain('2026-02-02T00:00:00.000Z');
    });
    expect(mockLoadDesign).toHaveBeenCalledTimes(2);
  });
});
