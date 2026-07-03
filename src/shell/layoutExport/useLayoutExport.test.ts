import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ok } from '@/core/result';
import { designId } from '@/core/types';
import type { Bin } from '@/core/types';
import { useLayoutStore } from '@/core/store/layout';
import { createTestLayout, createTestBin, resetAllStores } from '@/test/testUtils';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';

const h = vi.hoisted(() => ({
  bridge: { exportBin: vi.fn(), exportCombined: vi.fn() },
  triggerDownload: vi.fn(),
  trackEvent: vi.fn(),
  buildBaseplateExportPieces: vi.fn(),
  loadDesign: vi.fn(),
  bridgeAcquire: vi.fn(),
  bridgeRelease: vi.fn(),
  poolAcquire: vi.fn(),
  poolRelease: vi.fn(),
}));

vi.mock('@/shared/generation/bridge', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  bridgeManager: { acquire: h.bridgeAcquire, release: h.bridgeRelease },
  workerPoolManager: { acquire: h.poolAcquire, release: h.poolRelease },
}));
vi.mock('@/shared/generation/exportUtils', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  triggerDownload: h.triggerDownload,
}));
vi.mock('@/shared/analytics/posthog', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  trackEvent: h.trackEvent,
}));
vi.mock('@/features/baseplate', () => ({
  buildBaseplateExportPieces: h.buildBaseplateExportPieces,
}));
vi.mock('@/features/bin-designer', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  loadDesign: h.loadDesign,
}));

import { useLayoutExport } from './useLayoutExport';

function design(id: string, name: string, params: Partial<typeof DEFAULT_BIN_PARAMS> = {}) {
  return ok({
    id: designId(id),
    name,
    params: { ...DEFAULT_BIN_PARAMS, width: 1, depth: 1, height: 6, ...params },
    thumbnail: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    exportFileNameConfig: null,
  });
}

beforeEach(() => {
  resetAllStores();
  vi.clearAllMocks();
  h.bridge.exportBin.mockResolvedValue({ data: new ArrayBuffer(8), fileName: 'x', format: 'stl' });
  h.buildBaseplateExportPieces.mockResolvedValue({
    pieces: [{ data: new ArrayBuffer(8), label: '' }],
    guideText: '',
    baseNameNoExt: 'plate',
    extension: '.stl',
  });
  h.loadDesign.mockImplementation((id: string) =>
    Promise.resolve(design(id, id === 'd2' ? 'Tray' : 'Box'))
  );
  h.bridge.exportCombined.mockResolvedValue({
    pieces: [{ data: new ArrayBuffer(8), label: 'bin' }],
    format: 'stl',
  });
  h.bridgeAcquire.mockResolvedValue(h.bridge);
  h.poolAcquire.mockResolvedValue({ isDestroyed: false, size: 1 });

  const bins: Bin[] = [
    createTestBin({ linkedDesignId: designId('d1') }),
    { ...createTestBin({ x: 1 }), x: 1, linkedDesignId: designId('d1') },
    { ...createTestBin({ x: 2 }), x: 2, linkedDesignId: designId('d2') },
  ];
  useLayoutStore.setState({ layout: createTestLayout({ name: 'My Drawer', bins }) });
});

const CONFIG = { style: 'descriptive', customName: '', format: 'stl' } as const;

describe('useLayoutExport', () => {
  it('exports unique linked designs + baseplate as one ZIP and tracks it', async () => {
    const { result } = renderHook(() => useLayoutExport());

    const success = await result.current.exportLayout('stl', 'my-zip', CONFIG);

    expect(success).toBe(true);
    // Two unique designs (d1 deduped, d2) → two bin exports.
    expect(h.bridge.exportBin).toHaveBeenCalledTimes(2);
    expect(h.buildBaseplateExportPieces).toHaveBeenCalledTimes(1);
    expect(h.triggerDownload).toHaveBeenCalledWith(expect.any(Blob), 'my-zip.zip');
    expect(h.trackEvent).toHaveBeenCalledWith('ui.layoutExported', {
      format: 'zip',
      fileFormat: 'stl',
    });
    expect(h.bridgeRelease).toHaveBeenCalledTimes(1);
    expect(h.poolRelease).toHaveBeenCalledTimes(1);
  });

  it('exports lid/divider companion parts via the combined flow', async () => {
    // Single slotted design → removable dividers → combined export path.
    h.loadDesign.mockImplementation((id: string) =>
      Promise.resolve(design(id, 'Slotted', { style: 'slotted' }))
    );
    h.bridge.exportCombined.mockResolvedValue({
      pieces: [
        { data: new ArrayBuffer(8), label: 'bin' },
        { data: new ArrayBuffer(8), label: 'divider-horizontal' },
      ],
      format: 'stl',
    });
    useLayoutStore.setState({
      layout: createTestLayout({
        name: 'L',
        bins: [createTestBin({ linkedDesignId: designId('d1') })],
      }),
    });
    const { result } = renderHook(() => useLayoutExport());

    const success = await result.current.exportLayout('stl', 'z', CONFIG);

    expect(success).toBe(true);
    // Companion designs go through exportCombined, not the single-bin path.
    expect(h.bridge.exportCombined).toHaveBeenCalledTimes(1);
    expect(h.bridge.exportBin).not.toHaveBeenCalled();
    expect(h.triggerDownload).toHaveBeenCalledWith(expect.any(Blob), 'z.zip');
  });

  it('returns false without exporting when there are no linked bins', async () => {
    useLayoutStore.setState({ layout: createTestLayout({ name: 'Empty', bins: [] }) });
    const { result } = renderHook(() => useLayoutExport());

    const success = await result.current.exportLayout('stl', 'empty', CONFIG);

    expect(success).toBe(false);
    expect(h.triggerDownload).not.toHaveBeenCalled();
    expect(h.buildBaseplateExportPieces).not.toHaveBeenCalled();
    // Bridge was never acquired, so it must not be released.
    expect(h.bridgeRelease).not.toHaveBeenCalled();
  });

  it('still ships a baseplate-only ZIP when every linked design fails to load', async () => {
    h.loadDesign.mockResolvedValue({ ok: false, error: { kind: 'storage' } });
    const { result } = renderHook(() => useLayoutExport());

    const success = await result.current.exportLayout('stl', 'z', CONFIG);

    expect(success).toBe(true);
    expect(h.bridge.exportBin).not.toHaveBeenCalled();
    expect(h.triggerDownload).toHaveBeenCalledWith(expect.any(Blob), 'z.zip');
  });

  it('still ships bins when the baseplate phase fails, and releases resources', async () => {
    h.buildBaseplateExportPieces.mockRejectedValue(new Error('degenerate drawer'));
    const { result } = renderHook(() => useLayoutExport());

    const success = await result.current.exportLayout('stl', 'z', CONFIG);

    expect(success).toBe(true);
    expect(h.bridge.exportBin).toHaveBeenCalledTimes(2);
    expect(h.triggerDownload).toHaveBeenCalledWith(expect.any(Blob), 'z.zip');
    expect(h.bridgeRelease).toHaveBeenCalledTimes(1);
    expect(h.poolRelease).toHaveBeenCalledTimes(1);
  });

  it('reports engine-not-ready and does not release when the bridge fails to acquire', async () => {
    h.bridgeAcquire.mockRejectedValue(new Error('wasm load failed'));
    const { result } = renderHook(() => useLayoutExport());

    const success = await result.current.exportLayout('stl', 'z', CONFIG);

    expect(success).toBe(false);
    expect(h.bridgeRelease).not.toHaveBeenCalled();
    expect(h.poolRelease).not.toHaveBeenCalled();
    expect(h.triggerDownload).not.toHaveBeenCalled();
  });
});
