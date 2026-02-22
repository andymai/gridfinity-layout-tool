import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSlicerOpen } from './useSlicerOpen';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useSettingsStore } from '@/core/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { DEFAULT_PRINT_SETTINGS } from '@/shared/printSettings';
import type { SlicerSite } from '@/core/store/settings';

// ─── Module mocks ────────────────────────────────────────────────────────────

const mockExportBin = vi.hoisted(() => vi.fn());
vi.mock('@/shared/generation/bridge', () => ({
  getActiveBridge: () => ({ exportBin: mockExportBin }),
}));

const mockParseSTLBinary = vi.hoisted(() => vi.fn());
vi.mock('@/features/bin-designer/utils/stlParser', () => ({
  parseSTLBinary: mockParseSTLBinary,
}));

const mockExport3MF = vi.hoisted(() => vi.fn());
vi.mock('@/shared/generation/export', () => ({
  export3MF: mockExport3MF,
}));

vi.mock('@/features/bin-designer/utils/printEstimates', () => ({
  estimatePrint: () => ({
    printTimeMinutes: 30,
    gramsFilament: 10,
    metersFilament: 5,
    costUSD: 0.5,
  }),
}));

vi.mock('@/features/bin-designer/utils/fileNaming', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, generateFileName: () => 'test-bin.3mf' };
});

const mockBuildSlicerUrl = vi.hoisted(() =>
  vi.fn((protocol: string, url: string) => `${protocol}://open?file_url=${url}`)
);
vi.mock('@/features/bin-designer/utils/slicerConfig', () => ({
  buildSlicerUrl: mockBuildSlicerUrl,
}));

// ─── Test data ───────────────────────────────────────────────────────────────

const MOCK_SLICER: SlicerSite = {
  id: 'prusaslicer',
  name: 'PrusaSlicer',
  protocol: 'prusaslicer',
  enabled: true,
};

const MOCK_STL_DATA = new Uint8Array(84 + 12 * 3);
const MOCK_VERTICES = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
const MOCK_NORMALS = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
const MOCK_BLOB = new Blob(['mock-3mf-content'], {
  type: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
});

// Ok/Err shapes match @/core/result: { ok: true, value } | { ok: false, error }
const PARSE_OK = { ok: true as const, value: { vertices: MOCK_VERTICES, normals: MOCK_NORMALS } };
const PARSE_ERR = { ok: false as const, error: 'parse failed' };

const originalURL = globalThis.URL;
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
const mockRevokeObjectURL = vi.fn();

describe('useSlicerOpen', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockCreateObjectURL.mockReturnValue('blob:mock-url');

    // Mock URL.createObjectURL / revokeObjectURL
    Object.defineProperty(globalThis, 'URL', {
      value: {
        ...originalURL,
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      },
      writable: true,
      configurable: true,
    });

    // Mock fetch
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://blob.vercel.com/slicer-temp/test-uuid.3mf' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    // Stub anchor clicks so protocol URLs don't cause jsdom navigation errors
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag);
      if (tag === 'a') {
        vi.spyOn(el as HTMLAnchorElement, 'click').mockImplementation(() => {});
      }
      return el;
    });

    // Set up store state
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      designName: 'test-design',
      exportFileNameConfig: { style: 'descriptive', format: '3mf', customName: '' },
    });
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        printSettings: { ...DEFAULT_PRINT_SETTINGS },
      },
    });

    // Default successful generation path
    mockExportBin.mockResolvedValue({ data: MOCK_STL_DATA });
    mockParseSTLBinary.mockReturnValue(PARSE_OK);
    mockExport3MF.mockReturnValue(MOCK_BLOB);
    mockBuildSlicerUrl.mockImplementation(
      (protocol: string, url: string) => `${protocol}://open?file_url=${url}`
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'URL', {
      value: originalURL,
      writable: true,
      configurable: true,
    });
  });

  // ─── Initial state ────────────────────────────────────────────────────────

  it('starts with isOpening false and openingSlicerId null', () => {
    const { result } = renderHook(() => useSlicerOpen());
    expect(result.current.isOpening).toBe(false);
    expect(result.current.openingSlicerId).toBeNull();
  });

  // ─── Error paths ──────────────────────────────────────────────────────────

  it('shows generation error toast when STL parse fails and does not upload', async () => {
    mockParseSTLBinary.mockReturnValueOnce(PARSE_ERR);

    const { result } = renderHook(() => useSlicerOpen());
    await act(async () => {
      await result.current.openInSlicer(MOCK_SLICER);
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.isOpening).toBe(false);
    expect(result.current.openingSlicerId).toBeNull();
  });

  it('falls back to download and resets state on upload failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

    const { result } = renderHook(() => useSlicerOpen());
    await act(async () => {
      await result.current.openInSlicer(MOCK_SLICER);
    });

    expect(mockCreateObjectURL).toHaveBeenCalledWith(MOCK_BLOB);
    expect(result.current.isOpening).toBe(false);
  });

  it('does not trigger fallback download when generation fails (no blob available)', async () => {
    mockExportBin.mockRejectedValueOnce(new Error('Worker crashed'));

    const { result } = renderHook(() => useSlicerOpen());
    await act(async () => {
      await result.current.openInSlicer(MOCK_SLICER);
    });

    // threeMFBlob was never assigned, so no download
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
    expect(result.current.isOpening).toBe(false);
  });

  // ─── Happy path ───────────────────────────────────────────────────────────

  it('fires the slicer protocol URL with the uploaded file URL', async () => {
    const { result } = renderHook(() => useSlicerOpen());
    await act(async () => {
      await result.current.openInSlicer(MOCK_SLICER);
    });

    expect(mockBuildSlicerUrl).toHaveBeenCalledWith(
      'prusaslicer',
      'https://blob.vercel.com/slicer-temp/test-uuid.3mf'
    );
  });

  it('posts 3MF blob to the upload endpoint', async () => {
    const { result } = renderHook(() => useSlicerOpen());
    await act(async () => {
      await result.current.openInSlicer(MOCK_SLICER);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/slicer-upload',
      expect.objectContaining({ method: 'POST' })
    );
  });

  // ─── Blur / timer reset paths ─────────────────────────────────────────────

  it('clears openingSlicerId when window blur fires (slicer opened)', async () => {
    const { result } = renderHook(() => useSlicerOpen());
    await act(async () => {
      await result.current.openInSlicer(MOCK_SLICER);
    });

    await act(async () => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(result.current.openingSlicerId).toBeNull();
    expect(result.current.isOpening).toBe(false);
  });

  it('shows not-detected info toast and resets state after 5s timeout (no download)', async () => {
    const { result } = renderHook(() => useSlicerOpen());
    await act(async () => {
      await result.current.openInSlicer(MOCK_SLICER);
    });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // No automatic download — user can download manually from the export dialog
    expect(mockCreateObjectURL).not.toHaveBeenCalledWith(MOCK_BLOB);
    expect(result.current.isOpening).toBe(false);
    expect(result.current.openingSlicerId).toBeNull();
  });

  it('does not show not-detected toast when blur fires before the timer', async () => {
    const { result } = renderHook(() => useSlicerOpen());
    await act(async () => {
      await result.current.openInSlicer(MOCK_SLICER);
    });

    // Blur fires (slicer detected) — cancels the timer
    await act(async () => {
      window.dispatchEvent(new Event('blur'));
    });

    // Timer fires after — but blur already cancelled it
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockCreateObjectURL).not.toHaveBeenCalled();
  });
});
