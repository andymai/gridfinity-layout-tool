import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { unzipSync } from 'fflate';
import { designId } from '@/core/types';
import { ok } from '@/core/result';
import { useSettingsStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import { loadDesign, type BinParams, type SavedDesign } from '@/features/bin-designer';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { bridgeManager, type CombinedExportResult } from '@/shared/generation/bridge';
import { triggerDownload } from '@/shared/generation/exportUtils';
import type * as ExportUtils from '@/shared/generation/exportUtils';
import { useQuickExport } from './useQuickExport';

vi.mock('@/features/bin-designer', () => ({
  loadDesign: vi.fn(),
  generateFileName: vi.fn(() => 'box.stl'),
}));

vi.mock('@/shared/generation/bridge', () => ({
  bridgeManager: { acquire: vi.fn(), release: vi.fn() },
}));

vi.mock('@/shared/generation/exportUtils', async (importOriginal) => ({
  ...(await importOriginal<typeof ExportUtils>()),
  triggerDownload: vi.fn(),
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

function piece(label: string, byte = 0): CombinedExportResult['pieces'][number] {
  return { data: new Uint8Array([byte, byte, byte, byte]).buffer, label };
}

describe('useQuickExport', () => {
  const exportCombined = vi.fn<
    (params: BinParams, format: string) => Promise<CombinedExportResult>
  >(async () => ({ pieces: [piece('bin')], format: 'stl' }));

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    vi.mocked(bridgeManager.acquire).mockResolvedValue({ exportCombined } as unknown as Awaited<
      ReturnType<typeof bridgeManager.acquire>
    >);
  });

  async function runExport(label = 'Box'): Promise<void> {
    const { result } = renderHook(() => useQuickExport());
    await act(() => result.current.exportToSTL(D1, 'Box', label));
  }

  async function exportedParams(label: string): Promise<BinParams> {
    await runExport(label);
    return exportCombined.mock.calls[0][0];
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

  it('downloads a lone body as a plain STL', async () => {
    vi.mocked(loadDesign).mockResolvedValue(ok(design()));
    await runExport();
    expect(triggerDownload).toHaveBeenCalledTimes(1);
    expect(vi.mocked(triggerDownload).mock.calls[0][1]).toBe('box.stl');
  });

  it('ships feet, lid and dividers alongside the body in a ZIP', async () => {
    vi.mocked(loadDesign).mockResolvedValue(ok(design()));
    exportCombined.mockResolvedValueOnce({
      pieces: [piece('bin', 1), piece('lid', 2), piece('feet', 3), piece('dividers', 4)],
      format: 'stl',
    });
    await runExport();
    expect(triggerDownload).toHaveBeenCalledTimes(1);
    const [blob, name] = vi.mocked(triggerDownload).mock.calls[0];
    expect(name).toBe('box.zip');
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(
      Object.fromEntries(Object.entries(files).map(([file, bytes]) => [file, bytes[0]]))
    ).toEqual({ 'box_bin.stl': 1, 'box_lid.stl': 2, 'box_feet.stl': 3, 'box_dividers.stl': 4 });
  });

  it('sizes a label socket for the configured nozzle', async () => {
    useSettingsStore.setState((s) => ({
      settings: {
        ...s.settings,
        printSettings: { ...s.settings.printSettings, nozzleSizeMm: 0.6 },
      },
    }));
    vi.mocked(loadDesign).mockResolvedValue(
      ok(design({ label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, mode: 'socket' } }))
    );
    expect((await exportedParams('Box')).nozzleSizeMm).toBe(0.6);
  });
});
