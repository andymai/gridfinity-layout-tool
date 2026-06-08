import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnectorSampleExport } from './useConnectorSampleExport';
import { triggerDownload } from '@/shared/generation/exportUtils';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation:
    () =>
    (key: string): string =>
      key,
}));

let activeBridge: unknown = null;
vi.mock('@/shared/generation/bridge', () => ({
  getActiveBridge: () => activeBridge,
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

  it('reports canExport from the active bridge presence', () => {
    const { result, rerender } = renderHook(() => useConnectorSampleExport());
    expect(result.current.canExport).toBe(false);

    activeBridge = {};
    rerender();
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
