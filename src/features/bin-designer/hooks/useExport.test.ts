import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExport } from '@/features/bin-designer/hooks/useExport';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useSettingsStore } from '@/core/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { DEFAULT_PRINT_SETTINGS } from '@/shared/printSettings';

// Mock the bridge module
const mockExportBin = vi.fn();
vi.mock('@/shared/generation/bridge', () => ({
  getActiveBridge: () => ({
    exportBin: mockExportBin,
  }),
}));

// Mock URL.createObjectURL and URL.revokeObjectURL
const originalURL = globalThis.URL;
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
const mockRevokeObjectURL = vi.fn();

describe('useExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExportBin.mockReset();
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

  it('provides export function', () => {
    const { result } = renderHook(() => useExport());
    expect(result.current.downloadSTL).toBeTypeOf('function');
  });

  it('isExporting is initially false', () => {
    const { result } = renderHook(() => useExport());
    expect(result.current.isExporting).toBe(false);
  });

  it('downloadSTL creates blob URL and triggers download via bridge', async () => {
    // Set up valid mesh
    useDesignerStore.setState({
      generation: {
        status: 'complete',
        mesh: {
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
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
      await result.current.downloadSTL({ style: 'descriptive', customName: '' });
    });

    expect(mockExportBin).toHaveBeenCalledWith(expect.any(Object), 'stl');
    expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('downloadSTL respects name style parameter', async () => {
    useDesignerStore.setState({
      generation: {
        status: 'complete',
        mesh: {
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
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

    const mockAnchor = { href: '', download: '', click: vi.fn() };
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
      await result.current.downloadSTL({ style: 'compact', customName: '' });
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
});
