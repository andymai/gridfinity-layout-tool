import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExport } from '@/features/bin-designer/hooks/useExport';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useSettingsStore } from '@/core/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { DEFAULT_PRINT_SETTINGS } from '@/shared/printSettings';

// Mock the bridge module
const mockExportBin = vi.fn();
const mockExportSplitBin = vi.fn();
vi.mock('@/shared/generation/bridge', () => ({
  getActiveBridge: () => ({
    exportBin: mockExportBin,
    exportSplitBin: mockExportSplitBin,
  }),
}));

// Mock JSZip used by splitExport
vi.mock('jszip', () => ({
  default: class MockJSZip {
    file = vi.fn();
    generateAsync = vi.fn().mockResolvedValue(new Blob(['zip']));
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
      generation: {
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

    // Mock bridge to return STL data
    mockExportBin.mockResolvedValue({
      data: new ArrayBuffer(100),
      fileName: 'test.stl',
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

    expect(mockExportBin).toHaveBeenCalledWith(expect.any(Object), 'stl');
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

    mockExportBin.mockResolvedValue({
      data: new ArrayBuffer(200),
      fileName: 'test.step',
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

    expect(mockExportBin).toHaveBeenCalledWith(expect.any(Object), 'step');
    expect(mockAnchor.download).toContain('.step');

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('downloadBin respects name style parameter', async () => {
    useDesignerStore.setState({
      generation: {
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

    // Mock bridge
    mockExportBin.mockResolvedValue({
      data: new ArrayBuffer(100),
      fileName: 'test.stl',
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

  it('maxGridUnits derives from settings', () => {
    // Default: 256mm / 42mm = 6 grid units
    const { result } = renderHook(() => useExport());
    expect(result.current.maxGridUnits).toBe(6);
  });

  it('provides downloadSplit function', () => {
    const { result } = renderHook(() => useExport());
    expect(result.current.downloadSplit).toBeTypeOf('function');
  });

  it('downloadSplit calls bridge.exportSplitBin and creates ZIP', async () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3 },
      generation: {
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
});
