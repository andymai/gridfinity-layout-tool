import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExport } from '@/features/bin-designer/hooks/useExport';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useSettingsStore } from '@/core/store';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_GENERATION_STATE,
} from '@/features/bin-designer/constants/defaults';
import { DEFAULT_PRINT_SETTINGS } from '@/shared/printSettings';
import { recordCommunityExport } from '@/shared/api/communityAttribution';
import type { CommunityDesignLineage } from '@/shared/types/community';

vi.mock('@/shared/api/communityAttribution', () => ({
  recordCommunityExport: vi.fn().mockResolvedValue(undefined),
}));
const mockRecordCommunityExport = vi.mocked(recordCommunityExport);

// Mock the bridge module
const mockExportBin = vi.fn();
const mockExportCombined = vi.fn();
const mockExportSplitBin = vi.fn();
vi.mock('@/shared/generation/bridge', () => ({
  getActiveBridge: () => ({
    exportBin: mockExportBin,
    exportCombined: mockExportCombined,
    exportSplitBin: mockExportSplitBin,
  }),
  getActiveKernel: () => 'occt-wasm',
  bridgeManager: {
    get engineReady() {
      return true;
    },
    subscribe: (listener: (ready: boolean) => void) => {
      listener(true);
      return () => {};
    },
    refresh: () => {},
  },
  workerPoolManager: {
    get: () => null,
    acquire: () => Promise.reject(new Error('No pool in test')),
    release: () => {},
  },
}));

// Mock URL.createObjectURL and URL.revokeObjectURL
const originalURL = globalThis.URL;
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
const mockRevokeObjectURL = vi.fn();

describe('useExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExportBin.mockReset();
    mockExportCombined.mockReset();
    mockExportSplitBin.mockReset();
    // Apply URL mock before each test
    Object.defineProperty(globalThis, 'URL', {
      value: {
        ...originalURL,
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      },
      writable: true,
    });
    // Reset store to defaults
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      lineage: null,
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'idle',
        mesh: null,
        progress: 0,
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'URL', { value: originalURL, writable: true });
    vi.restoreAllMocks();
  });

  it('canExport is false when no mesh is available', () => {
    const { result } = renderHook(() => useExport());
    expect(result.current.canExport).toBe(false);
  });

  it('canExport is true when mesh with vertices exists', () => {
    useDesignerStore.setState({
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'complete',
        mesh: {
          vertices: new Float32Array(9),
          normals: new Float32Array(9),
          indices: new Uint32Array([0, 1, 2]),
          edgeVertices: new Float32Array(0),
          error: null,
          timingMs: 10,
        },
        progress: 1,
      },
    });

    const { result } = renderHook(() => useExport());
    expect(result.current.canExport).toBe(true);
  });

  it('canExport is false when mesh has an error', () => {
    useDesignerStore.setState({
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'error',
        mesh: {
          vertices: null,
          normals: null,
          indices: null,
          edgeVertices: null,
          error: 'Generation failed',
          timingMs: 0,
        },
        progress: 0,
      },
    });

    const { result } = renderHook(() => useExport());
    expect(result.current.canExport).toBe(false);
  });

  it('provides print estimates', () => {
    const { result } = renderHook(() => useExport());
    expect(result.current.estimates.volumeMm3).toBeGreaterThan(0);
    expect(result.current.estimates.gramsFilament).toBeGreaterThan(0);
    expect(result.current.estimates.metersFilament).toBeGreaterThan(0);
  });

  it('provides downloadBin function', () => {
    const { result } = renderHook(() => useExport());
    expect(result.current.downloadBin).toBeTypeOf('function');
  });

  it('isExporting is initially false', () => {
    const { result } = renderHook(() => useExport());
    expect(result.current.isExporting).toBe(false);
  });

  it('downloadBin with stl format creates blob URL and triggers download via bridge', async () => {
    // Set up valid mesh
    useDesignerStore.setState({
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'complete',
        mesh: {
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
          indices: new Uint32Array([0, 1, 2]),
          edgeVertices: new Float32Array(0),
          error: null,
          timingMs: 10,
        },
        progress: 1,
      },
    });

    // Mock combined export to return single bin piece (no dividers)
    mockExportCombined.mockResolvedValue({
      pieces: [{ data: new ArrayBuffer(100), label: 'bin' }],
      format: 'stl',
    });

    // Mock DOM APIs - only intercept 'a' elements to not break renderHook container
    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
      parentNode: document.body,
    };
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement;
        return originalCreateElement(tag);
      });
    const appendChildSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => node);
    const removeChildSpy = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation((node) => node);

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.downloadBin('stl', {
        style: 'descriptive',
        customName: '',
        format: 'stl',
      });
    });

    expect(mockExportCombined).toHaveBeenCalledWith(
      expect.any(Object),
      'stl',
      expect.objectContaining({ onProgress: expect.any(Function) })
    );
    expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('downloadBin with step format calls bridge with step', async () => {
    useDesignerStore.setState({
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'complete',
        mesh: {
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
          indices: new Uint32Array([0, 1, 2]),
          edgeVertices: new Float32Array(0),
          error: null,
          timingMs: 10,
        },
        progress: 1,
      },
    });

    mockExportCombined.mockResolvedValue({
      pieces: [{ data: new ArrayBuffer(200), label: 'assembly' }],
      format: 'step',
    });

    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
      parentNode: document.body,
    };
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement;
        return originalCreateElement(tag);
      });
    const appendChildSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => node);
    const removeChildSpy = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation((node) => node);

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.downloadBin('step', {
        style: 'descriptive',
        customName: '',
        format: 'step',
      });
    });

    expect(mockExportCombined).toHaveBeenCalledWith(
      expect.any(Object),
      'step',
      expect.objectContaining({ onProgress: expect.any(Function) })
    );
    expect(mockAnchor.download).toContain('.step');

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('downloadBin respects name style parameter', async () => {
    useDesignerStore.setState({
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'complete',
        mesh: {
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
          indices: new Uint32Array([0, 1, 2]),
          edgeVertices: new Float32Array(0),
          error: null,
          timingMs: 10,
        },
        progress: 1,
      },
    });

    mockExportCombined.mockResolvedValue({
      pieces: [{ data: new ArrayBuffer(100), label: 'bin' }],
      format: 'stl',
    });

    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
      parentNode: document.body,
    };
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement;
        return originalCreateElement(tag);
      });
    const appendChildSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => node);
    const removeChildSpy = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation((node) => node);

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.downloadBin('stl', {
        style: 'compact',
        customName: '',
        format: 'stl',
      });
    });

    expect(mockAnchor.download).toContain('gf_');

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('estimates update when params change', () => {
    const { result, rerender } = renderHook(() => useExport());
    const initialVolume = result.current.estimates.volumeMm3;

    act(() => {
      useDesignerStore.getState().setParams({ width: 4, depth: 4 });
    });

    rerender();
    expect(result.current.estimates.volumeMm3).toBeGreaterThan(initialVolume);
  });

  it('estimates cost updates when print settings change', () => {
    const { result, rerender } = renderHook(() => useExport());
    const initialCost = result.current.estimates.costUSD;

    // Double the filament cost
    act(() => {
      useSettingsStore.getState().updateSetting('printSettings', {
        ...DEFAULT_PRINT_SETTINGS,
        filamentCostPerKg: 40,
      });
    });

    rerender();
    expect(result.current.estimates.costUSD).toBeGreaterThan(initialCost);
  });

  it('estimates print time updates when layer height changes', () => {
    const { result, rerender } = renderHook(() => useExport());
    const baselineTime = result.current.estimates.printTimeMinutes;

    // Use thinner layers → should increase time
    act(() => {
      useSettingsStore.getState().updateSetting('printSettings', {
        ...DEFAULT_PRINT_SETTINGS,
        layerHeightMm: 0.1,
      });
    });

    rerender();
    expect(result.current.estimates.printTimeMinutes).toBeGreaterThan(baselineTime);
  });

  // ─── Split export tests ──────────────────────────────────────────────────

  it('needsSplit is false when bin fits print bed', () => {
    const { result } = renderHook(() => useExport());
    expect(result.current.needsSplit).toBe(false);
    expect(result.current.splitPieceCount).toBe(1);
  });

  it('needsSplit is true when width exceeds maxGridUnits', () => {
    act(() => {
      useDesignerStore.getState().setParams({ width: 8 });
    });

    const { result } = renderHook(() => useExport());
    expect(result.current.needsSplit).toBe(true);
    expect(result.current.splitPieceCount).toBeGreaterThan(1);
  });

  it('needsSplit is true when depth exceeds maxGridUnits', () => {
    act(() => {
      useDesignerStore.getState().setParams({ depth: 8 });
    });

    const { result } = renderHook(() => useExport());
    expect(result.current.needsSplit).toBe(true);
  });

  it('provides downloadSplit function', () => {
    const { result } = renderHook(() => useExport());
    expect(result.current.downloadSplit).toBeTypeOf('function');
  });

  it('downloadSplit calls bridge.exportSplitBin and creates ZIP', async () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3 },
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'complete',
        mesh: {
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
          indices: new Uint32Array([0, 1, 2]),
          edgeVertices: new Float32Array(0),
          error: null,
          timingMs: 10,
        },
        progress: 1,
      },
    });

    mockExportSplitBin.mockResolvedValue({
      pieces: [
        { data: new ArrayBuffer(50), label: 'piece-1x1', col: 1, row: 1 },
        { data: new ArrayBuffer(50), label: 'piece-2x1', col: 2, row: 1 },
      ],
    });

    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
      parentNode: document.body,
    };
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement;
        return originalCreateElement(tag);
      });
    const appendChildSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => node);
    const removeChildSpy = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation((node) => node);

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.downloadSplit('stl', {
        style: 'descriptive',
        customName: '',
        format: 'stl',
      });
    });

    expect(mockExportSplitBin).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({
        splitConnectorConfig: expect.objectContaining({ enabled: true }),
      })
    );
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockAnchor.download).toContain('_split.zip');
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  // ─── Split export under STEP ─────────────────────────────────────

  describe('downloadSplit under STEP', () => {
    /** Stub the download DOM plumbing; returns the anchor plus a restore fn. */
    function mockDownloadDom(): {
      anchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };
      restore: () => void;
    } {
      const anchor = { href: '', download: '', click: vi.fn(), parentNode: document.body };
      const originalCreateElement = document.createElement.bind(document);
      const createElementSpy = vi
        .spyOn(document, 'createElement')
        .mockImplementation((tag: string) => {
          if (tag === 'a') return anchor as unknown as HTMLAnchorElement;
          return originalCreateElement(tag);
        });
      const appendChildSpy = vi
        .spyOn(document.body, 'appendChild')
        .mockImplementation((node) => node);
      const removeChildSpy = vi
        .spyOn(document.body, 'removeChild')
        .mockImplementation((node) => node);
      return {
        anchor,
        restore: () => {
          createElementSpy.mockRestore();
          appendChildSpy.mockRestore();
          removeChildSpy.mockRestore();
        },
      };
    }

    function setOversizedBin(overrides: Partial<typeof DEFAULT_BIN_PARAMS> = {}): void {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3, ...overrides },
        generation: {
          ...DEFAULT_GENERATION_STATE,
          status: 'complete',
          mesh: {
            vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
            normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
            indices: new Uint32Array([0, 1, 2]),
            edgeVertices: new Float32Array(0),
            error: null,
            timingMs: 10,
          },
          progress: 1,
        },
      });
    }

    it('asks the worker for STEP pieces and names them .step in the ZIP', async () => {
      setOversizedBin();
      mockExportSplitBin.mockResolvedValue({
        pieces: [
          { data: new ArrayBuffer(50), label: 'piece-1x1', col: 1, row: 1 },
          { data: new ArrayBuffer(50), label: 'piece-2x1', col: 2, row: 1 },
        ],
      });
      const dom = mockDownloadDom();

      const { result } = renderHook(() => useExport());
      let succeeded = false;
      await act(async () => {
        succeeded = await result.current.downloadSplit('step', {
          style: 'descriptive',
          customName: '',
          format: 'step',
        });
      });

      expect(succeeded).toBe(true);
      expect(mockExportSplitBin).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({ format: 'step' })
      );

      // Read the real ZIP the hook built. Entry names live uncompressed in the
      // local file headers, so a `.stl` extension here would be a wrong-format
      // archive that still downloaded happily.
      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      const entryNames = await blob.text();
      expect(entryNames).toContain('.step');
      expect(entryNames).not.toContain('.stl');
      expect(dom.anchor.download).toContain('_split.zip');

      dom.restore();
    });

    it('takes lid companions as separate STEP pieces, not the bin-bearing compound', async () => {
      // A lid makes the split export run a second combined pass for companions.
      // Under STEP that pass defaults to one compound assembly WITH the bin in
      // it — the body is already covered by the split pieces, so asking for the
      // compound would ship the whole bin a second time.
      setOversizedBin({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
      });
      mockExportSplitBin.mockResolvedValue({
        pieces: [{ data: new ArrayBuffer(50), label: 'piece-1x1', col: 1, row: 1 }],
      });
      mockExportCombined.mockResolvedValue({
        pieces: [
          { data: new ArrayBuffer(30), label: 'bin' },
          { data: new ArrayBuffer(20), label: 'lid' },
        ],
        faceGroups: [],
      });
      const dom = mockDownloadDom();

      const { result } = renderHook(() => useExport());
      await act(async () => {
        await result.current.downloadSplit('step', {
          style: 'descriptive',
          customName: '',
          format: 'step',
        });
      });

      expect(mockExportCombined).toHaveBeenCalledWith(
        expect.any(Object),
        'step',
        expect.objectContaining({ separatePieces: true })
      );

      dom.restore();
    });
  });

  // ─── Export attribution tests ────────────────────────────────────────────

  describe('export attribution', () => {
    const TEST_LINEAGE: CommunityDesignLineage = {
      parentId: 'parent-design-id',
      rootId: 'root-design-id',
      parentName: 'Parent design',
      parentAuthorName: 'Parent Author',
      rootAuthorName: 'Root Author',
    };

    /** Stub the download DOM plumbing; returns a restore function. */
    function mockDownloadDom(): () => void {
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
        parentNode: document.body,
      };
      const originalCreateElement = document.createElement.bind(document);
      const createElementSpy = vi
        .spyOn(document, 'createElement')
        .mockImplementation((tag: string) => {
          if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement;
          return originalCreateElement(tag);
        });
      const appendChildSpy = vi
        .spyOn(document.body, 'appendChild')
        .mockImplementation((node) => node);
      const removeChildSpy = vi
        .spyOn(document.body, 'removeChild')
        .mockImplementation((node) => node);
      return () => {
        createElementSpy.mockRestore();
        appendChildSpy.mockRestore();
        removeChildSpy.mockRestore();
      };
    }

    const EXPORT_CONFIG = {
      style: 'descriptive',
      customName: '',
      format: 'stl',
    } as const;

    it('credits the lineage parent exactly once per completed export', async () => {
      useDesignerStore.setState({ lineage: TEST_LINEAGE });
      mockExportCombined.mockResolvedValue({
        pieces: [{ data: new ArrayBuffer(100), label: 'bin' }],
        format: 'stl',
      });
      const restoreDom = mockDownloadDom();

      const { result } = renderHook(() => useExport());

      await act(async () => {
        const succeeded = await result.current.downloadBin('stl', EXPORT_CONFIG);
        expect(succeeded).toBe(true);
      });

      expect(mockRecordCommunityExport).toHaveBeenCalledTimes(1);
      expect(mockRecordCommunityExport).toHaveBeenCalledWith('parent-design-id');

      // A second completed export attributes again: dedupe is server-side.
      await act(async () => {
        await result.current.downloadBin('stl', EXPORT_CONFIG);
      });
      expect(mockRecordCommunityExport).toHaveBeenCalledTimes(2);

      restoreDom();
    });

    it('does not attribute when the design has no lineage', async () => {
      mockExportCombined.mockResolvedValue({
        pieces: [{ data: new ArrayBuffer(100), label: 'bin' }],
        format: 'stl',
      });
      const restoreDom = mockDownloadDom();

      const { result } = renderHook(() => useExport());

      await act(async () => {
        const succeeded = await result.current.downloadBin('stl', EXPORT_CONFIG);
        expect(succeeded).toBe(true);
      });

      expect(mockRecordCommunityExport).not.toHaveBeenCalled();

      restoreDom();
    });

    it('does not attribute when the export fails', async () => {
      // The failure toast builds a report-issue URL via `new URL(...)`, which
      // the suite-wide createObjectURL mock (a plain object) cannot construct.
      Object.defineProperty(globalThis, 'URL', { value: originalURL, writable: true });
      useDesignerStore.setState({ lineage: TEST_LINEAGE });
      // Non-retryable error code so exportWithResilience fails immediately.
      mockExportCombined.mockRejectedValue(new Error('invalid params'));
      const restoreDom = mockDownloadDom();

      const { result } = renderHook(() => useExport());

      await act(async () => {
        const succeeded = await result.current.downloadBin('stl', EXPORT_CONFIG);
        expect(succeeded).toBe(false);
      });

      expect(mockRecordCommunityExport).not.toHaveBeenCalled();

      restoreDom();
    });

    it('credits the lineage parent on a completed split export', async () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3 },
        lineage: TEST_LINEAGE,
      });
      mockExportSplitBin.mockResolvedValue({
        pieces: [
          { data: new ArrayBuffer(50), label: 'piece-1x1', col: 1, row: 1 },
          { data: new ArrayBuffer(50), label: 'piece-2x1', col: 2, row: 1 },
        ],
      });
      const restoreDom = mockDownloadDom();

      const { result } = renderHook(() => useExport());

      await act(async () => {
        const succeeded = await result.current.downloadSplit('stl', EXPORT_CONFIG);
        expect(succeeded).toBe(true);
      });

      expect(mockRecordCommunityExport).toHaveBeenCalledTimes(1);
      expect(mockRecordCommunityExport).toHaveBeenCalledWith('parent-design-id');

      restoreDom();
    });
  });
});
