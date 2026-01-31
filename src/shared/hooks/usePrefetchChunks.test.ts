import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePrefetchChunks } from './usePrefetchChunks';

// Mock useResponsive to control device type
vi.mock('./useResponsive', () => ({
  useResponsive: vi.fn(() => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false,
    layoutMode: 'desktop' as const,
    viewportWidth: 1200,
    viewportHeight: 800,
    isLandscape: true,
  })),
}));

// Grab the mocked module so we can change return values per-test
import { useResponsive } from './useResponsive';
const mockUseResponsive = vi.mocked(useResponsive);

describe('usePrefetchChunks', () => {
  let originalRIC: typeof window.requestIdleCallback;
  let originalConnection: unknown;

  beforeEach(() => {
    vi.useFakeTimers();
    originalRIC = window.requestIdleCallback;
    originalConnection = (navigator as unknown as Record<string, unknown>).connection;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.requestIdleCallback = originalRIC;
    Object.defineProperty(navigator, 'connection', {
      value: originalConnection,
      configurable: true,
      writable: true,
    });
  });

  it('calls requestIdleCallback after delay on desktop', () => {
    const mockRIC = vi.fn();
    window.requestIdleCallback = mockRIC as unknown as typeof window.requestIdleCallback;

    renderHook(() => usePrefetchChunks());

    // Before delay — no idle callbacks yet
    expect(mockRIC).not.toHaveBeenCalled();

    // After 3s delay
    vi.advanceTimersByTime(3000);

    // Should have scheduled 3 idle callbacks (high, medium, low tiers)
    expect(mockRIC).toHaveBeenCalledTimes(3);
  });

  it('skips prefetch on mobile', () => {
    mockUseResponsive.mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isTouchDevice: true,
      layoutMode: 'mobile' as const,
      viewportWidth: 375,
      viewportHeight: 667,
      isLandscape: false,
    });

    const mockRIC = vi.fn();
    window.requestIdleCallback = mockRIC as unknown as typeof window.requestIdleCallback;

    renderHook(() => usePrefetchChunks());
    vi.advanceTimersByTime(5000);

    expect(mockRIC).not.toHaveBeenCalled();
  });

  it('skips prefetch on tablet', () => {
    mockUseResponsive.mockReturnValue({
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      isTouchDevice: true,
      layoutMode: 'tablet' as const,
      viewportWidth: 800,
      viewportHeight: 1024,
      isLandscape: false,
    });

    const mockRIC = vi.fn();
    window.requestIdleCallback = mockRIC as unknown as typeof window.requestIdleCallback;

    renderHook(() => usePrefetchChunks());
    vi.advanceTimersByTime(5000);

    expect(mockRIC).not.toHaveBeenCalled();
  });

  it('skips prefetch when saveData is enabled', () => {
    Object.defineProperty(navigator, 'connection', {
      value: { saveData: true },
      configurable: true,
      writable: true,
    });

    const mockRIC = vi.fn();
    window.requestIdleCallback = mockRIC as unknown as typeof window.requestIdleCallback;

    renderHook(() => usePrefetchChunks());
    vi.advanceTimersByTime(5000);

    expect(mockRIC).not.toHaveBeenCalled();
  });

  it('skips prefetch on slow connections', () => {
    Object.defineProperty(navigator, 'connection', {
      value: { effectiveType: '2g' },
      configurable: true,
      writable: true,
    });

    const mockRIC = vi.fn();
    window.requestIdleCallback = mockRIC as unknown as typeof window.requestIdleCallback;

    renderHook(() => usePrefetchChunks());
    vi.advanceTimersByTime(5000);

    expect(mockRIC).not.toHaveBeenCalled();
  });

  it('falls back to setTimeout when requestIdleCallback is unavailable', () => {
    // Remove requestIdleCallback to trigger fallback path

    delete (window as unknown as Record<string, unknown>).requestIdleCallback;

    // Should not throw — the fallback path uses setTimeout instead
    expect(() => {
      renderHook(() => usePrefetchChunks());
      // Advance past the initial 3s delay + fallback 200ms delays
      vi.advanceTimersByTime(3500);
    }).not.toThrow();
  });

  it('does not throw when dynamic imports fail', () => {
    // Mock requestIdleCallback to execute callbacks immediately
    window.requestIdleCallback = ((cb: (deadline: { timeRemaining: () => number }) => void) => {
      cb({ timeRemaining: () => 50 });
      return 0;
    }) as unknown as typeof window.requestIdleCallback;

    // This should not throw even though the dynamic imports will fail
    // in the test environment (modules don't exist)
    expect(() => {
      renderHook(() => usePrefetchChunks());
      vi.advanceTimersByTime(3000);
    }).not.toThrow();
  });

  it('cleans up timer on unmount before it fires', () => {
    const mockRIC = vi.fn();
    window.requestIdleCallback = mockRIC as unknown as typeof window.requestIdleCallback;

    const { unmount } = renderHook(() => usePrefetchChunks());

    // Unmount before the 3s delay elapses
    unmount();

    // Advance time — the idle callbacks should NOT have been scheduled
    vi.advanceTimersByTime(5000);
    expect(mockRIC).not.toHaveBeenCalled();
  });
});
