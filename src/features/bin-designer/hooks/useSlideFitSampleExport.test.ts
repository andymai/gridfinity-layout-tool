import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSlideFitSampleExport } from './useSlideFitSampleExport';
import { triggerDownload } from '@/shared/generation/exportUtils';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

let activeBridge: unknown = null;
vi.mock('@/shared/generation/bridge', () => ({
  getActiveBridge: () => activeBridge,
}));

vi.mock('@/shared/generation/exportUtils', () => ({
  triggerDownload: vi.fn(),
  FORMAT_MIME_TYPES: { stl: 'model/stl', step: 'model/step', '3mf': 'model/3mf' },
  FORMAT_EXTENSIONS: { stl: '.stl', step: '.step', '3mf': '.3mf' },
}));

vi.mock('@/shared/generation/stlParser', async () => {
  const { ok } = await import('@/core/result');
  return {
    parseSTLBinary: () =>
      ok({
        vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      }),
  };
});
vi.mock('@/shared/generation/export', () => ({ export3MF: () => new Blob(['3mf']) }));

describe('useSlideFitSampleExport', () => {
  beforeEach(() => {
    resetAllStores();
    activeBridge = null;
    vi.mocked(triggerDownload).mockClear();
  });

  it('reports canExport from the active bridge presence', () => {
    const { result, rerender } = renderHook(() => useSlideFitSampleExport());
    expect(result.current.canExport).toBe(false);
    activeBridge = {};
    rerender();
    expect(result.current.canExport).toBe(true);
  });

  it('refuses to export without a bridge', async () => {
    const { result } = renderHook(() => useSlideFitSampleExport());
    let ok = true;
    await act(async () => {
      ok = await result.current.downloadSample('stl');
    });
    expect(ok).toBe(false);
    expect(triggerDownload).not.toHaveBeenCalled();
  });

  it("sends the design's own slide config, not a generic one", async () => {
    // The coupon's rail profile follows the config's shelf reach and thickness,
    // so a card built from defaults would test a shelf this design never has.
    const spy = vi.fn().mockResolvedValue({ data: new ArrayBuffer(8) });
    activeBridge = { exportSlideFitSample: spy };
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        slide: { ...DEFAULT_BIN_PARAMS.slide, railProtrusionMm: 3 },
      },
    });
    const { result } = renderHook(() => useSlideFitSampleExport());
    await act(async () => {
      await result.current.downloadSample('stl');
    });
    expect(spy).toHaveBeenCalledWith('stl', expect.objectContaining({ railProtrusionMm: 3 }));
    expect(triggerDownload).toHaveBeenCalled();
  });

  it('names the download after the card', async () => {
    activeBridge = {
      exportSlideFitSample: vi.fn().mockResolvedValue({ data: new ArrayBuffer(8) }),
    };
    const { result } = renderHook(() => useSlideFitSampleExport());
    await act(async () => {
      await result.current.downloadSample('stl');
    });
    expect(vi.mocked(triggerDownload).mock.calls[0][1]).toBe('slide-fit-sample.stl');
  });
});
