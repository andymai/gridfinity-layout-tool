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

// Mock the idle utility to control scheduling behavior
vi.mock('@/shared/utils/idle', () => ({
  scheduleIdleCallback: vi.fn(
    (cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void) => {
      cb({ didTimeout: false, timeRemaining: () => 50 });
      return Math.random();
    }
  ),
  cancelIdleCallback: vi.fn(),
}));

// Grab mocked modules for per-test control
import { useResponsive } from './useResponsive';
import { scheduleIdleCallback, cancelIdleCallback } from '@/shared/utils/idle';
const mockUseResponsive = vi.mocked(useResponsive);
const mockScheduleIdle = vi.mocked(scheduleIdleCallback);
const mockCancelIdle = vi.mocked(cancelIdleCallback);

describe('usePrefetchChunks', () => {
  let originalConnection: unknown;

  beforeEach(() => {
    vi.useFakeTimers();
    originalConnection = (navigator as unknown as Record<string, unknown>).connection;
    // Reset to desktop defaults — tests that need mobile/tablet override this
    mockUseResponsive.mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      layoutMode: 'desktop' as const,
      viewportWidth: 1200,
      viewportHeight: 800,
      isLandscape: true,
    });
    mockScheduleIdle.mockClear();
    mockCancelIdle.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'connection', {
      value: originalConnection,
      configurable: true,
      writable: true,
    });
  });

  it('schedules idle callback after delay on desktop', () => {
    renderHook(() => usePrefetchChunks());

    // Before delay — no idle callbacks yet
    expect(mockScheduleIdle).not.toHaveBeenCalled();

    // After 3s delay — schedules idle callbacks (chained: high → medium → low)
    vi.advanceTimersByTime(3000);
    expect(mockScheduleIdle).toHaveBeenCalled();
  });

  it('chains all three priority tiers via nested idle callbacks', () => {
    renderHook(() => usePrefetchChunks());
    vi.advanceTimersByTime(3000);

    // With synchronous execution mock, all 3 tiers chain: high → medium → low
    expect(mockScheduleIdle).toHaveBeenCalledTimes(3);
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

    renderHook(() => usePrefetchChunks());
    vi.advanceTimersByTime(5000);

    expect(mockScheduleIdle).not.toHaveBeenCalled();
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

    renderHook(() => usePrefetchChunks());
    vi.advanceTimersByTime(5000);

    expect(mockScheduleIdle).not.toHaveBeenCalled();
  });

  it('skips prefetch when saveData is enabled', () => {
    Object.defineProperty(navigator, 'connection', {
      value: { saveData: true },
      configurable: true,
      writable: true,
    });

    renderHook(() => usePrefetchChunks());
    vi.advanceTimersByTime(5000);

    expect(mockScheduleIdle).not.toHaveBeenCalled();
  });

  it('skips prefetch on slow connections', () => {
    Object.defineProperty(navigator, 'connection', {
      value: { effectiveType: '2g' },
      configurable: true,
      writable: true,
    });

    renderHook(() => usePrefetchChunks());
    vi.advanceTimersByTime(5000);

    expect(mockScheduleIdle).not.toHaveBeenCalled();
  });

  it('does not throw when dynamic imports fail', () => {
    // The default mock executes callbacks synchronously, which triggers
    // the dynamic imports. These fail in test (modules don't exist)
    // but errors are caught silently.
    expect(() => {
      renderHook(() => usePrefetchChunks());
      vi.advanceTimersByTime(3000);
    }).not.toThrow();
  });

  it('cleans up timer on unmount before it fires', () => {
    const { unmount } = renderHook(() => usePrefetchChunks());

    // Unmount before the 3s delay elapses
    unmount();

    // Advance time — the idle callbacks should NOT have been scheduled
    vi.advanceTimersByTime(5000);
    expect(mockScheduleIdle).not.toHaveBeenCalled();
  });

  it('cancels idle callback handles on unmount', () => {
    const { unmount } = renderHook(() => usePrefetchChunks());

    // Before timer fires — no cancellations
    expect(mockCancelIdle).not.toHaveBeenCalled();

    // Let the timer fire — mock executes callbacks synchronously,
    // collecting 3 handles (one per priority tier)
    vi.advanceTimersByTime(3000);
    const handles = mockScheduleIdle.mock.results.map((r) => r.value);
    expect(handles).toHaveLength(3);

    // Unmount — should cancel all collected idle handles
    unmount();
    expect(mockCancelIdle).toHaveBeenCalledTimes(3);
    handles.forEach((handle) => {
      expect(mockCancelIdle).toHaveBeenCalledWith(handle);
    });
  });
});
