import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { designId } from '@/core/types';
import { ok } from '@/core/result';
import { resetAllStores } from '@/test/testUtils';
import { loadDesign, type BinParams, type SavedDesign } from '@/features/bin-designer';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { bridgeManager } from '@/shared/generation/bridge';
import { useQuickExport } from './useQuickExport';

vi.mock('@/features/bin-designer', () => ({
  loadDesign: vi.fn(),
  generateFileName: vi.fn(() => 'box.stl'),
}));

vi.mock('@/shared/generation/bridge', () => ({
  bridgeManager: { acquire: vi.fn(), release: vi.fn() },
}));

const D1 = designId('design-1');

function design(params: Partial<BinParams> = {}): SavedDesign {
  return {
    id: D1,
    name: 'Box',
    params: {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      ...params,
    },
    thumbnail: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    exportFileNameConfig: null,
  };
}

describe('useQuickExport', () => {
  const exportBin = vi.fn<(params: BinParams, format: string) => Promise<{ data: ArrayBuffer }>>(
    async () => ({ data: new ArrayBuffer(4) })
  );

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
    vi.mocked(bridgeManager.acquire).mockResolvedValue({ exportBin } as unknown as Awaited<
      ReturnType<typeof bridgeManager.acquire>
    >);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function exportedParams(label: string): Promise<BinParams> {
    const { result } = renderHook(() => useQuickExport());
    await act(() => result.current.exportToSTL(D1, 'Box', label));
    return exportBin.mock.calls[0][0];
  }

  it('prints the bin label in a blank single caption', async () => {
    vi.mocked(loadDesign).mockResolvedValue(ok(design()));
    expect((await exportedParams('Screws')).compartments.compartmentTexts).toEqual(['Screws']);
  });

  it('keeps the design caption when it has its own', async () => {
    vi.mocked(loadDesign).mockResolvedValue(
      ok(
        design({
          compartments: { ...DEFAULT_BIN_PARAMS.compartments, compartmentTexts: ['HARDWARE'] },
        })
      )
    );
    expect((await exportedParams('Screws')).compartments.compartmentTexts).toEqual(['HARDWARE']);
  });
});
