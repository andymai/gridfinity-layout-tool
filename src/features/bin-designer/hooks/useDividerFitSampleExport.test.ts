import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDividerFitSampleExport } from './useDividerFitSampleExport';
import { triggerDownload } from '@/shared/generation/exportUtils';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store/toast';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { MIN_WALL_FOR_SLOTS } from '@/shared/utils/slotMath';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

let activeBridge: unknown = null;
vi.mock('@/shared/generation/bridge', () => ({
  getActiveBridge: () => activeBridge,
  bridgeManager: {
    get engineReady() {
      return activeBridge !== null;
    },
    subscribe: (listener: (ready: boolean) => void) => {
      listener(activeBridge !== null);
      return () => undefined;
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

const SLOTTED = {
  ...DEFAULT_BIN_PARAMS,
  style: 'slotted' as const,
  slotConfig: {
    ...DEFAULT_BIN_PARAMS.slotConfig,
    x: { enabled: true, pitch: 40 },
    y: { enabled: false, pitch: 40 },
  },
};

describe('useDividerFitSampleExport', () => {
  beforeEach(() => {
    resetAllStores();
    activeBridge = {};
    useDesignerStore.setState({ params: SLOTTED });
    vi.mocked(triggerDownload).mockClear();
  });

  it("sends the design's own params, piece fit included", async () => {
    // The section's slot and the piece both follow the design, so a sample
    // built from defaults would test a slot this bin never has.
    const spy = vi.fn().mockResolvedValue({ data: new ArrayBuffer(8) });
    activeBridge = { exportDividerFitSample: spy };
    useDesignerStore.setState({
      params: {
        ...SLOTTED,
        dividerPieces: { ...SLOTTED.dividerPieces, clearance: 0.1, pieceFit: 0.15 },
      },
    });
    const { result } = renderHook(() => useDividerFitSampleExport());
    await act(async () => {
      await result.current.downloadSample('stl');
    });
    expect(spy).toHaveBeenCalledWith(
      'stl',
      expect.objectContaining({
        dividerPieces: expect.objectContaining({ clearance: 0.1, pieceFit: 0.15 }),
      })
    );
    expect(vi.mocked(triggerDownload).mock.calls[0][1]).toBe('divider-fit-sample.stl');
  });

  it('converts to 3MF through the STL parser rather than shipping raw STL', async () => {
    const spy = vi.fn().mockResolvedValue({ data: new ArrayBuffer(8) });
    activeBridge = { exportDividerFitSample: spy };
    const { result } = renderHook(() => useDividerFitSampleExport());
    await act(async () => {
      await result.current.downloadSample('3mf');
    });
    expect(spy).toHaveBeenCalledWith('stl', expect.anything());
    expect(vi.mocked(triggerDownload).mock.calls[0][1]).toBe('divider-fit-sample.3mf');
  });

  it('reports failure and stops exporting when the bridge throws', async () => {
    activeBridge = { exportDividerFitSample: vi.fn().mockRejectedValue(new Error('kernel died')) };
    const { result } = renderHook(() => useDividerFitSampleExport());
    let ok = true;
    await act(async () => {
      ok = await result.current.downloadSample('stl');
    });
    expect(ok).toBe(false);
    expect(result.current.isExporting).toBe(false);
    expect(useToastStore.getState().toasts[0].message).toBe('kernel died');
  });

  it('cannot export a bin with no slot to sample', () => {
    useDesignerStore.setState({
      params: { ...SLOTTED, wallThickness: MIN_WALL_FOR_SLOTS - 0.1 },
    });
    expect(renderHook(() => useDividerFitSampleExport()).result.current.canExport).toBe(false);

    useDesignerStore.setState({
      params: {
        ...SLOTTED,
        slotConfig: {
          ...SLOTTED.slotConfig,
          x: { ...SLOTTED.slotConfig.x, enabled: false },
        },
      },
    });
    expect(renderHook(() => useDividerFitSampleExport()).result.current.canExport).toBe(false);

    // An enabled axis whose spacing places no divider has no slot either.
    useDesignerStore.setState({
      params: {
        ...SLOTTED,
        width: 1,
        depth: 1,
        slotConfig: {
          ...SLOTTED.slotConfig,
          x: { enabled: true, pitch: 40 },
          y: { enabled: false, pitch: 40 },
        },
      },
    });
    expect(renderHook(() => useDividerFitSampleExport()).result.current.canExport).toBe(false);

    useDesignerStore.setState({ params: SLOTTED });
    expect(renderHook(() => useDividerFitSampleExport()).result.current.canExport).toBe(true);
  });
});
