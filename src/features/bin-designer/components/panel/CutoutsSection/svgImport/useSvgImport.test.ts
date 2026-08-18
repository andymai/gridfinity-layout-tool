import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSvgImport } from './useSvgImport';
import { MAX_SVG_FILE_SIZE } from './types';

// Mock store
const mockAddCutout = vi.fn();
const mockStartTransaction = vi.fn();
const mockCommitTransaction = vi.fn();

vi.mock('@/features/bin-designer/store', async () => {
  const { remainingCutoutCapacity } = await vi.importActual<{
    remainingCutoutCapacity: (target: unknown, cutouts: unknown) => number;
  }>('@/features/bin-designer/store/slices/cutoutSlice');
  const useDesignerStore = (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      addCutout: mockAddCutout,
      startTransaction: mockStartTransaction,
      commitTransaction: mockCommitTransaction,
    });
  // The capacity gate reads committed state imperatively; a bin-target board
  // has no cap, so the per-add refusals below still drive the clipped paths.
  useDesignerStore.getState = () => ({
    ui: { cutoutTarget: 'bin' },
    params: { lid: { cutouts: [] } },
  });
  return { useDesignerStore, remainingCutoutCapacity };
});

const mockAddToast = vi.fn();
vi.mock('@/core/store/toast', () => ({
  useToastStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ addToast: mockAddToast }),
}));

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const mockTrackEvent = vi.fn();
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}));

describe('useSvgImport', () => {
  afterEach(() => {
    vi.clearAllMocks();
    // Clean up any leftover inputs
    document.querySelectorAll('input[type="file"][accept=".svg"]').forEach((el) => el.remove());
  });

  it('appends a hidden file input to the DOM on mount', () => {
    renderHook(() => useSvgImport());
    const input = document.querySelector('input[type="file"][accept=".svg"]');
    expect(input).not.toBeNull();
    expect((input as HTMLElement).style.display).toBe('none');
  });

  it('removes the hidden file input on unmount', () => {
    const { unmount } = renderHook(() => useSvgImport());
    expect(document.querySelector('input[type="file"][accept=".svg"]')).not.toBeNull();

    unmount();
    expect(document.querySelector('input[type="file"][accept=".svg"]')).toBeNull();
  });

  it('returns a triggerImport function', () => {
    const { result } = renderHook(() => useSvgImport());
    expect(typeof result.current.triggerImport).toBe('function');
  });

  it('triggerImport clicks the hidden file input', () => {
    const { result } = renderHook(() => useSvgImport());
    const input = document.querySelector('input[type="file"][accept=".svg"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    result.current.triggerImport();
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('rejects files exceeding MAX_SVG_FILE_SIZE', () => {
    renderHook(() => useSvgImport());
    const input = document.querySelector('input[type="file"][accept=".svg"]') as HTMLInputElement;

    const oversizedFile = new File(['x'], 'huge.svg', { type: 'image/svg+xml' });
    Object.defineProperty(oversizedFile, 'size', { value: MAX_SVG_FILE_SIZE + 1 });

    // Simulate file selection
    Object.defineProperty(input, 'files', { value: [oversizedFile], configurable: true });
    act(() => {
      input.dispatchEvent(new Event('change'));
    });

    expect(mockAddToast).toHaveBeenCalledWith('toast.svgImport.fileTooLarge', 'error');
    expect(mockTrackEvent).toHaveBeenCalledWith('svg_import', {
      success: false,
      error_code: 'SVG_FILE_TOO_LARGE',
    });
  });

  /** Drive a real SVG through the file input and wait for FileReader. */
  async function importSvg(shapeCount: number): Promise<void> {
    const rects = Array.from(
      { length: shapeCount },
      (_, i) => `<rect x="${i * 12}" y="0" width="10" height="10"/>`
    ).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">${rects}</svg>`;
    const input = document.querySelector('input[type="file"][accept=".svg"]') as HTMLInputElement;
    const file = new File([svg], 'shapes.svg', { type: 'image/svg+xml' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    act(() => {
      input.dispatchEvent(new Event('change'));
    });
    await vi.waitFor(() => expect(mockAddToast).toHaveBeenCalled());
  }

  it('reports the stored count, not the requested one, when the target is full', async () => {
    // The cap refuses the tail of the batch. Toasting `specs.length` would tell
    // the user the design holds shapes it silently dropped.
    mockAddCutout.mockImplementation(() => mockAddCutout.mock.calls.length <= 2);
    renderHook(() => useSvgImport());

    await importSvg(5);

    expect(mockAddCutout).toHaveBeenCalledTimes(5);
    expect(mockAddToast).toHaveBeenCalledWith('toast.cutoutsClipped', 'error');
    expect(mockAddToast).not.toHaveBeenCalledWith('toast.svgImport.success', 'success');
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'svg_import',
      expect.objectContaining({ success: true, shape_count: 5, added_count: 2 })
    );
  });

  it('reports success when every shape landed', async () => {
    mockAddCutout.mockImplementation(() => true);
    renderHook(() => useSvgImport());

    await importSvg(3);

    expect(mockAddToast).toHaveBeenCalledWith('toast.svgImport.success', 'success');
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'svg_import',
      expect.objectContaining({ shape_count: 3, added_count: 3 })
    );
  });
});
