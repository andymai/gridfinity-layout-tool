import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useExport } from '@/features/bin-designer/hooks/useExport';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';

// Mock the bridge module
const mockGenerateForExport = vi.fn();
const mockBridge = {
  generateForExport: mockGenerateForExport,
  exportBin: vi.fn(),
};

vi.mock('@/shared/generation/bridge', () => ({
  getActiveBridge: vi.fn(() => mockBridge),
}));

// Import after mocking
import { getActiveBridge } from '@/shared/generation/bridge';

// Mock URL.createObjectURL and URL.revokeObjectURL
const originalURL = globalThis.URL;
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
const mockRevokeObjectURL = vi.fn();

describe('useExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Apply URL mock before each test
    Object.defineProperty(globalThis, 'URL', {
      value: {
        ...originalURL,
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      },
      writable: true,
    });
    // Set up mock bridge to return export-quality mesh
    mockGenerateForExport.mockResolvedValue({
      mesh: {
        vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        triangleCount: 1,
      },
      timingMs: 100,
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

  it('canExport is true when bridge is available', () => {
    const { result } = renderHook(() => useExport());
    expect(result.current.canExport).toBe(true);
  });

  it('canExport is false when bridge is not available', () => {
    vi.mocked(getActiveBridge).mockReturnValue(null);

    const { result } = renderHook(() => useExport());
    expect(result.current.canExport).toBe(false);

    // Restore mock for other tests
    vi.mocked(getActiveBridge).mockReturnValue(mockBridge);
  });

  it('canExportBREP mirrors canExport (uses same bridge)', () => {
    const { result } = renderHook(() => useExport());
    expect(result.current.canExportBREP).toBe(result.current.canExport);
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
    expect(result.current.download3MF).toBeTypeOf('function');
  });

  it('isExporting is initially false', () => {
    const { result } = renderHook(() => useExport());
    expect(result.current.isExporting).toBe(false);
  });

  it('downloadSTL does nothing when bridge is not available', async () => {
    vi.mocked(getActiveBridge).mockReturnValue(null);

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.downloadSTL({ style: 'descriptive', customName: '' });
    });

    expect(mockGenerateForExport).not.toHaveBeenCalled();
    expect(mockCreateObjectURL).not.toHaveBeenCalled();

    // Restore mock for other tests
    vi.mocked(getActiveBridge).mockReturnValue(mockBridge);
  });

  it('downloadSTL generates high-quality mesh via bridge and triggers download', async () => {
    // Mock DOM APIs - only intercept 'a' elements to not break renderHook container
    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement;
      return originalCreateElement(tag);
    });
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.downloadSTL({ style: 'descriptive', customName: '' });
    });

    // Verify bridge was called to generate high-quality mesh
    expect(mockGenerateForExport).toHaveBeenCalled();
    expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('downloadSTL respects name style parameter', async () => {
    const mockAnchor = { href: '', download: '', click: vi.fn() };
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement;
      return originalCreateElement(tag);
    });
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

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
});
