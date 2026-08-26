import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSlideFitSampleExport } from './useSlideFitSampleExport';
import { triggerDownload } from '@/shared/generation/exportUtils';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store/toast';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

let activeBridge: unknown = null;
const readyListeners = new Set<(ready: boolean) => void>();
function broadcastReady(ready: boolean): void {
  for (const listener of readyListeners) listener(ready);
}
vi.mock('@/shared/generation/bridge', () => ({
  getActiveBridge: () => activeBridge,
  bridgeManager: {
    get engineReady() {
      return activeBridge !== null;
    },
    subscribe: (listener: (ready: boolean) => void) => {
      readyListeners.add(listener);
      listener(activeBridge !== null);
      return () => readyListeners.delete(listener);
    },
  },
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

  it('follows engine readiness reactively, not the render-time bridge', () => {
    // A refresh nulls the bridge before the replacement boots; the button must
    // come back when readiness is broadcast, with nothing else re-rendering.
    activeBridge = null;
    const { result } = renderHook(() => useSlideFitSampleExport());
    expect(result.current.canExport).toBe(false);
    activeBridge = {};
    act(() => broadcastReady(true));
    expect(result.current.canExport).toBe(true);
  });

  it('refuses to export without a bridge, and says why', async () => {
    const { result } = renderHook(() => useSlideFitSampleExport());
    let ok = true;
    await act(async () => {
      ok = await result.current.downloadSample('stl');
    });
    expect(ok).toBe(false);
    expect(triggerDownload).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts[0].message).toBe('binDesigner.exportNotReady');
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

  it('converts to 3MF through the STL parser rather than shipping raw STL', async () => {
    // The 3MF branch is a different path: it exports STL from the worker, then
    // re-wraps it on the main thread. A regression there would download a file
    // named .3mf containing STL bytes.
    const spy = vi.fn().mockResolvedValue({ data: new ArrayBuffer(8) });
    activeBridge = { exportSlideFitSample: spy };
    const { result } = renderHook(() => useSlideFitSampleExport());
    await act(async () => {
      await result.current.downloadSample('3mf');
    });
    expect(spy).toHaveBeenCalledWith('stl', expect.anything());
    expect(vi.mocked(triggerDownload).mock.calls[0][1]).toBe('slide-fit-sample.3mf');
  });

  it('reports failure and stops exporting when the bridge throws', async () => {
    activeBridge = { exportSlideFitSample: vi.fn().mockRejectedValue(new Error('kernel died')) };
    const { result } = renderHook(() => useSlideFitSampleExport());
    let ok = true;
    await act(async () => {
      ok = await result.current.downloadSample('stl');
    });
    expect(ok).toBe(false);
    expect(result.current.isExporting).toBe(false);
    expect(triggerDownload).not.toHaveBeenCalled();
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
