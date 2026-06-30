import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ok } from '@/core/result';
import { designId } from '@/core/types';
import type { Bin } from '@/core/types';
import { useLayoutStore } from '@/core/store/layout';
import { createTestLayout, createTestBin } from '@/test/testUtils';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';

const h = vi.hoisted(() => ({
  bridge: { exportBin: vi.fn() },
  triggerDownload: vi.fn(),
  trackEvent: vi.fn(),
  buildBaseplateExportPieces: vi.fn(),
  loadDesign: vi.fn(),
}));

vi.mock('@/shared/generation/bridge', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  bridgeManager: { acquire: () => Promise.resolve(h.bridge), release: vi.fn() },
  workerPoolManager: {
    acquire: () => Promise.resolve({ isDestroyed: false, size: 1 }),
    release: vi.fn(),
  },
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

function design(id: string, name: string) {
  return ok({
    id: designId(id),
    name,
    params: { ...DEFAULT_BIN_PARAMS, width: 1, depth: 1, height: 6 },
    thumbnail: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    exportFileNameConfig: null,
  });
}

beforeEach(() => {
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

  const bins: Bin[] = [
    createTestBin({ linkedDesignId: designId('d1') }),
    { ...createTestBin({ x: 1 }), x: 1, linkedDesignId: designId('d1') },
    { ...createTestBin({ x: 2 }), x: 2, linkedDesignId: designId('d2') },
  ];
  useLayoutStore.setState({ layout: createTestLayout({ name: 'My Drawer', bins }) });
});

describe('useLayoutExport', () => {
  it('exports unique linked designs + baseplate as one ZIP and tracks it', async () => {
    const { result } = renderHook(() => useLayoutExport());

    const success = await result.current.exportLayout('stl', 'my-zip');

    expect(success).toBe(true);
    // Two unique designs (d1 deduped, d2) → two bin exports.
    expect(h.bridge.exportBin).toHaveBeenCalledTimes(2);
    expect(h.buildBaseplateExportPieces).toHaveBeenCalledTimes(1);
    expect(h.triggerDownload).toHaveBeenCalledWith(expect.any(Blob), 'my-zip.zip');
    expect(h.trackEvent).toHaveBeenCalledWith('ui.layoutExported', {
      format: 'zip',
      fileFormat: 'stl',
    });
  });

  it('returns false without exporting when there are no linked bins', async () => {
    useLayoutStore.setState({ layout: createTestLayout({ name: 'Empty', bins: [] }) });
    const { result } = renderHook(() => useLayoutExport());

    const success = await result.current.exportLayout('stl', 'empty');

    expect(success).toBe(false);
    expect(h.triggerDownload).not.toHaveBeenCalled();
    expect(h.buildBaseplateExportPieces).not.toHaveBeenCalled();
  });
});
