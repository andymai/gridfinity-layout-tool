import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFitTestExport } from './useFitTestExport';
import { triggerDownload } from '@/shared/generation/exportUtils';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store/toast';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

interface FakeBridge {
  exportFitTest: ReturnType<typeof vi.fn>;
}

let activeBridge: FakeBridge | null = null;
const readyListeners = new Set<(ready: boolean) => void>();
function broadcastReady(ready: boolean): void {
  for (const listener of readyListeners) listener(ready);
}
vi.mock('@/shared/generation/bridge', () => ({
  getActiveBridge: () => activeBridge,
  // `useEngineReady` mirrors the bridge presence for these cases; `subscribe`
  // fires synchronously with the current state, as the real manager does, and
  // the captured listener lets a test broadcast a readiness transition.
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

// Pass-through: retry/restart behaviour is the wrapper's own suite's job;
// these cases assert the single-attempt contract around it.
vi.mock('../utils/exportWithResilience', () => ({
  exportWithResilience: async <T>(op: () => Promise<T>) => ({
    result: await op(),
    retryCount: 0,
    restartCount: 0,
  }),
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

const zipCalls: Array<{ pieces: readonly { label: string }[]; extension: string }> = [];
vi.mock('@/shared/generation/zipExport', () => ({
  packagePiecesAsZip: (
    pieces: readonly { label: string }[],
    _base: string,
    extension: string
  ): Blob => {
    zipCalls.push({ pieces, extension });
    return new Blob(['zip']);
  },
}));

const piece = (label = ''): { data: ArrayBuffer; label: string } => ({
  data: new ArrayBuffer(8),
  label,
});

describe('useFitTestExport', () => {
  beforeEach(() => {
    resetAllStores();
    zipCalls.length = 0;
    vi.mocked(triggerDownload).mockClear();
    activeBridge = {
      exportFitTest: vi.fn().mockResolvedValue({
        pieces: [piece()],
        fileName: 'fit-test.stl',
        blockedSeams: 0,
      }),
    };
  });

  it('follows engine readiness reactively, not the render-time bridge', () => {
    // A refresh nulls the bridge before the replacement boots; the button must
    // come back when readiness is broadcast, with nothing else re-rendering.
    activeBridge = null;
    const { result } = renderHook(() => useFitTestExport());
    expect(result.current.canExport).toBe(false);
    activeBridge = { exportFitTest: vi.fn() };
    act(() => broadcastReady(true));
    expect(result.current.canExport).toBe(true);
  });

  it('sends the live params, the thickness and the design name for the stamp', async () => {
    useDesignerStore.setState({ designName: 'Socket rail' });
    const { result } = renderHook(() => useFitTestExport());

    await act(async () => {
      await result.current.downloadCard({ format: 'stl', thicknessMm: 4.5 });
    });

    const call = activeBridge?.exportFitTest.mock.calls[0];
    expect(call?.[1]).toBe('stl');
    expect(call?.[2]).toMatchObject({
      thicknessMm: 4.5,
      stamp: { designName: 'Socket rail' },
    });
  });

  it('downloads a single-piece card as one file', async () => {
    const { result } = renderHook(() => useFitTestExport());
    await act(async () => {
      await result.current.downloadCard({ format: 'stl', thicknessMm: 4 });
    });
    expect(vi.mocked(triggerDownload).mock.calls[0][1]).toBe('fit-test.stl');
    expect(zipCalls).toHaveLength(0);
  });

  it('packages a split card as a ZIP', async () => {
    activeBridge = {
      exportFitTest: vi.fn().mockResolvedValue({
        pieces: [piece('A1'), piece('A2')],
        fileName: 'fit-test.stl',
        blockedSeams: 0,
      }),
    };
    const { result } = renderHook(() => useFitTestExport());
    await act(async () => {
      await result.current.downloadCard({ format: 'stl', thicknessMm: 4 });
    });
    expect(vi.mocked(triggerDownload).mock.calls[0][1]).toBe('fit-test.zip');
    expect(zipCalls[0].pieces).toHaveLength(2);
  });

  it('asks the worker for STL when the user picked 3MF, then converts', async () => {
    // 3MF is built on the client from the STL the worker returns, so requesting
    // "3mf" from the worker would ask it for a format it does not write.
    const { result } = renderHook(() => useFitTestExport());
    await act(async () => {
      await result.current.downloadCard({ format: '3mf', thicknessMm: 4 });
    });
    expect(activeBridge?.exportFitTest.mock.calls[0][1]).toBe('stl');
    expect(vi.mocked(triggerDownload).mock.calls[0][1]).toBe('fit-test.3mf');
  });

  it('names a split archive by the piece format, not by a guess', async () => {
    // A `.stl`-named archive of STEP bytes downloads perfectly happily, so the
    // extension has to follow the pieces (gotcha #20).
    activeBridge = {
      exportFitTest: vi.fn().mockResolvedValue({
        pieces: [piece('A1'), piece('A2')],
        fileName: 'fit-test.step',
        blockedSeams: 0,
      }),
    };
    const { result } = renderHook(() => useFitTestExport());
    await act(async () => {
      await result.current.downloadCard({ format: 'step', thicknessMm: 4 });
    });
    expect(zipCalls[0].extension).toBe('.step');
  });

  it('reports a seam the worker could not move clear of a cutout', async () => {
    activeBridge = {
      exportFitTest: vi.fn().mockResolvedValue({
        pieces: [piece('A1'), piece('A2')],
        fileName: 'fit-test.stl',
        blockedSeams: 1,
      }),
    };
    const { result } = renderHook(() => useFitTestExport());
    await act(async () => {
      await result.current.downloadCard({ format: 'stl', thicknessMm: 4 });
    });
    const messages = useToastStore.getState().toasts.map((toast) => toast.message);
    expect(messages).toContain('binDesigner.cutouts.fitTest.warnSeamThroughCutout');
  });

  it('says nothing when every seam found clear material', async () => {
    const { result } = renderHook(() => useFitTestExport());
    await act(async () => {
      await result.current.downloadCard({ format: 'stl', thicknessMm: 4 });
    });
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('surfaces a worker refusal instead of downloading nothing', async () => {
    activeBridge = {
      exportFitTest: vi.fn().mockRejectedValue(new Error('STEP is not available')),
    };
    const { result } = renderHook(() => useFitTestExport());

    let ok = true;
    await act(async () => {
      ok = await result.current.downloadCard({ format: 'step', thicknessMm: 4 });
    });
    expect(ok).toBe(false);
    expect(vi.mocked(triggerDownload)).not.toHaveBeenCalled();
  });
});
