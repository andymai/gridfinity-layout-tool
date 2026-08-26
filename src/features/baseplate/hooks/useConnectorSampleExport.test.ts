import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnectorSampleExport } from './useConnectorSampleExport';
import { triggerDownload } from '@/shared/generation/exportUtils';
import { useToastStore } from '@/core/store/toast';
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

// 3MF conversion is exercised via lightweight mocks — the STL→mesh→3MF pipeline
// itself is covered by the parser/export unit tests.
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
vi.mock('@/shared/generation/export', () => ({
  export3MF: () => new Blob(['3mf']),
}));

describe('useConnectorSampleExport', () => {
  beforeEach(() => {
    resetAllStores();
    activeBridge = null;
    vi.mocked(triggerDownload).mockClear();
  });

  it('follows engine readiness reactively, not the render-time bridge', () => {
    // A refresh nulls the bridge before the replacement boots; the button must
    // come back when readiness is broadcast, with nothing else re-rendering.
    activeBridge = null;
    const { result } = renderHook(() => useConnectorSampleExport());
    expect(result.current.canExport).toBe(false);
    activeBridge = {};
    act(() => broadcastReady(true));
    expect(result.current.canExport).toBe(true);
  });

  it('refuses to export and surfaces an error when no bridge is ready', async () => {
    const { result } = renderHook(() => useConnectorSampleExport());
    let ok = true;
    await act(async () => {
      ok = await result.current.downloadSample('stl');
    });
    expect(ok).toBe(false);
    expect(triggerDownload).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts[0].message).toBe('baseplate.exportNotReady');
  });

  it('exports STL straight from the bridge', async () => {
    const exportConnectorSample = vi
      .fn()
      .mockResolvedValue({ data: new ArrayBuffer(8), fileName: 'x.stl' });
    activeBridge = { exportConnectorSample };

    const { result } = renderHook(() => useConnectorSampleExport());
    let ok = false;
    await act(async () => {
      ok = await result.current.downloadSample('stl');
    });

    expect(ok).toBe(true);
    expect(exportConnectorSample).toHaveBeenCalledWith(expect.anything(), 'stl');
    expect(triggerDownload).toHaveBeenCalledTimes(1);
  });

  it('honors a custom base name in the downloaded filename', async () => {
    const exportConnectorSample = vi
      .fn()
      .mockResolvedValue({ data: new ArrayBuffer(8), fileName: 'x.stl' });
    activeBridge = { exportConnectorSample };

    const { result } = renderHook(() => useConnectorSampleExport());
    await act(async () => {
      await result.current.downloadSample('stl', 'my-card');
    });

    expect(triggerDownload).toHaveBeenCalledWith(expect.anything(), 'my-card.stl');
  });

  it('requests STL from the bridge and converts it for 3MF', async () => {
    const exportConnectorSample = vi
      .fn()
      .mockResolvedValue({ data: new ArrayBuffer(8), fileName: 'x.stl' });
    activeBridge = { exportConnectorSample };

    const { result } = renderHook(() => useConnectorSampleExport());
    let ok = false;
    await act(async () => {
      ok = await result.current.downloadSample('3mf');
    });

    expect(ok).toBe(true);
    // 3MF is synthesized from an STL export, never requested directly.
    expect(exportConnectorSample).toHaveBeenCalledWith(expect.anything(), 'stl');
    expect(triggerDownload).toHaveBeenCalledTimes(1);
  });
});
