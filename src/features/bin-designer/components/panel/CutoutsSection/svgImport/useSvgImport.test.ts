import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSvgImport } from './useSvgImport';
import { MAX_SVG_FILE_SIZE } from './types';

// Mock store
const mockAddCutout = vi.fn();
const mockStartTransaction = vi.fn();
const mockCommitTransaction = vi.fn();

vi.mock('@/features/bin-designer/store', () => ({
  useDesignerStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      addCutout: mockAddCutout,
      startTransaction: mockStartTransaction,
      commitTransaction: mockCommitTransaction,
    }),
}));

const mockAddToast = vi.fn();
vi.mock('@/core/store/toast', () => ({
  useToastStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ addToast: mockAddToast }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

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
});
