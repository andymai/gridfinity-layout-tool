import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResponsive, prefersTouch } from '../../hooks/useResponsive';
import { BREAKPOINTS } from '../../core/constants';

// Helper to create a matchMedia mock
function createMatchMediaMock(matches: Record<string, boolean>) {
  const listeners: Map<string, Set<() => void>> = new Map();

  return (query: string) => ({
    matches: matches[query] ?? false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((event: string, cb: () => void) => {
      if (!listeners.has(query)) {
        listeners.set(query, new Set());
      }
      listeners.get(query)!.add(cb);
    }),
    removeEventListener: vi.fn((event: string, cb: () => void) => {
      listeners.get(query)?.delete(cb);
    }),
    dispatchEvent: vi.fn(),
    // Helper to trigger change events
    _triggerChange: () => {
      listeners.get(query)?.forEach(cb => cb());
    },
  });
}

describe('useResponsive', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // Reset window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
    vi.restoreAllMocks();
  });

  describe('breakpoint detection', () => {
    it('detects mobile breakpoint (< 768px)', () => {
      Object.defineProperty(window, 'innerWidth', { value: 600, configurable: true });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: createMatchMediaMock({
          [`(max-width: ${BREAKPOINTS.MD - 1}px)`]: true,
          [`(min-width: ${BREAKPOINTS.MD}px) and (max-width: ${BREAKPOINTS.LG - 1}px)`]: false,
          [`(min-width: ${BREAKPOINTS.LG}px)`]: false,
          '(pointer: coarse)': false,
          '(orientation: landscape)': false,
        }),
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(false);
      expect(result.current.layoutMode).toBe('mobile');
    });

    it('detects tablet breakpoint (768-899px)', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: createMatchMediaMock({
          [`(max-width: ${BREAKPOINTS.MD - 1}px)`]: false,
          [`(min-width: ${BREAKPOINTS.MD}px) and (max-width: ${BREAKPOINTS.LG - 1}px)`]: true,
          [`(min-width: ${BREAKPOINTS.LG}px)`]: false,
          '(pointer: coarse)': false,
          '(orientation: landscape)': true,
        }),
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isDesktop).toBe(false);
      expect(result.current.layoutMode).toBe('tablet');
    });

    it('detects desktop breakpoint (>= 900px)', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: createMatchMediaMock({
          [`(max-width: ${BREAKPOINTS.MD - 1}px)`]: false,
          [`(min-width: ${BREAKPOINTS.MD}px) and (max-width: ${BREAKPOINTS.LG - 1}px)`]: false,
          [`(min-width: ${BREAKPOINTS.LG}px)`]: true,
          '(pointer: coarse)': false,
          '(orientation: landscape)': true,
        }),
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(true);
      expect(result.current.layoutMode).toBe('desktop');
    });
  });

  describe('touch detection', () => {
    it('detects touch device via pointer: coarse', () => {
      Object.defineProperty(window, 'innerWidth', { value: 768, configurable: true });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: createMatchMediaMock({
          [`(max-width: ${BREAKPOINTS.MD - 1}px)`]: false,
          [`(min-width: ${BREAKPOINTS.MD}px) and (max-width: ${BREAKPOINTS.LG - 1}px)`]: true,
          [`(min-width: ${BREAKPOINTS.LG}px)`]: false,
          '(pointer: coarse)': true,
          '(orientation: landscape)': false,
        }),
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isTouchDevice).toBe(true);
    });

    it('detects non-touch device', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: createMatchMediaMock({
          [`(max-width: ${BREAKPOINTS.MD - 1}px)`]: false,
          [`(min-width: ${BREAKPOINTS.MD}px) and (max-width: ${BREAKPOINTS.LG - 1}px)`]: false,
          [`(min-width: ${BREAKPOINTS.LG}px)`]: true,
          '(pointer: coarse)': false,
          '(orientation: landscape)': true,
        }),
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isTouchDevice).toBe(false);
    });
  });

  describe('orientation detection', () => {
    it('detects landscape orientation', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: createMatchMediaMock({
          [`(max-width: ${BREAKPOINTS.MD - 1}px)`]: false,
          [`(min-width: ${BREAKPOINTS.MD}px) and (max-width: ${BREAKPOINTS.LG - 1}px)`]: false,
          [`(min-width: ${BREAKPOINTS.LG}px)`]: true,
          '(pointer: coarse)': false,
          '(orientation: landscape)': true,
        }),
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isLandscape).toBe(true);
    });

    it('detects portrait orientation', () => {
      Object.defineProperty(window, 'innerWidth', { value: 768, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 1024, configurable: true });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: createMatchMediaMock({
          [`(max-width: ${BREAKPOINTS.MD - 1}px)`]: false,
          [`(min-width: ${BREAKPOINTS.MD}px) and (max-width: ${BREAKPOINTS.LG - 1}px)`]: true,
          [`(min-width: ${BREAKPOINTS.LG}px)`]: false,
          '(pointer: coarse)': true,
          '(orientation: landscape)': false,
        }),
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isLandscape).toBe(false);
    });
  });

  describe('viewport dimensions', () => {
    it('returns viewport width and height', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: createMatchMediaMock({
          [`(max-width: ${BREAKPOINTS.MD - 1}px)`]: false,
          [`(min-width: ${BREAKPOINTS.MD}px) and (max-width: ${BREAKPOINTS.LG - 1}px)`]: false,
          [`(min-width: ${BREAKPOINTS.LG}px)`]: true,
          '(pointer: coarse)': false,
          '(orientation: landscape)': true,
        }),
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.viewportWidth).toBe(1280);
      expect(result.current.viewportHeight).toBe(800);
    });
  });

  describe('resize handling', () => {
    it('updates on window resize (debounced)', () => {
      vi.useFakeTimers();

      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: createMatchMediaMock({
          [`(max-width: ${BREAKPOINTS.MD - 1}px)`]: false,
          [`(min-width: ${BREAKPOINTS.MD}px) and (max-width: ${BREAKPOINTS.LG - 1}px)`]: false,
          [`(min-width: ${BREAKPOINTS.LG}px)`]: true,
          '(pointer: coarse)': false,
          '(orientation: landscape)': true,
        }),
      });

      const { result } = renderHook(() => useResponsive());
      expect(result.current.viewportWidth).toBe(1024);

      // Simulate resize
      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 600, configurable: true });
        Object.defineProperty(window, 'matchMedia', {
          writable: true,
          configurable: true,
          value: createMatchMediaMock({
            [`(max-width: ${BREAKPOINTS.MD - 1}px)`]: true,
            [`(min-width: ${BREAKPOINTS.MD}px) and (max-width: ${BREAKPOINTS.LG - 1}px)`]: false,
            [`(min-width: ${BREAKPOINTS.LG}px)`]: false,
            '(pointer: coarse)': false,
            '(orientation: landscape)': false,
          }),
        });
        window.dispatchEvent(new Event('resize'));
      });

      // Resize events are debounced by 100ms for INP improvement
      // Advance timers to trigger the debounced update
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.viewportWidth).toBe(600);
      expect(result.current.isMobile).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('cleanup', () => {
    it('removes event listeners on unmount', () => {
      const removeEventListenerSpy = vi.fn();
      const mockMatchMedia = (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: removeEventListenerSpy,
        dispatchEvent: vi.fn(),
      });

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: mockMatchMedia,
      });

      const { unmount } = renderHook(() => useResponsive());
      unmount();

      // Should have removed listeners for all media queries and resize
      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });

  describe('breakpoint edge cases', () => {
    it('handles exact mobile boundary (767px)', () => {
      Object.defineProperty(window, 'innerWidth', { value: 767, configurable: true });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: createMatchMediaMock({
          [`(max-width: ${BREAKPOINTS.MD - 1}px)`]: true,
          [`(min-width: ${BREAKPOINTS.MD}px) and (max-width: ${BREAKPOINTS.LG - 1}px)`]: false,
          [`(min-width: ${BREAKPOINTS.LG}px)`]: false,
          '(pointer: coarse)': false,
          '(orientation: landscape)': true,
        }),
      });

      const { result } = renderHook(() => useResponsive());
      expect(result.current.isMobile).toBe(true);
      expect(result.current.layoutMode).toBe('mobile');
    });

    it('handles exact tablet boundary (768px)', () => {
      Object.defineProperty(window, 'innerWidth', { value: 768, configurable: true });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: createMatchMediaMock({
          [`(max-width: ${BREAKPOINTS.MD - 1}px)`]: false,
          [`(min-width: ${BREAKPOINTS.MD}px) and (max-width: ${BREAKPOINTS.LG - 1}px)`]: true,
          [`(min-width: ${BREAKPOINTS.LG}px)`]: false,
          '(pointer: coarse)': false,
          '(orientation: landscape)': false,
        }),
      });

      const { result } = renderHook(() => useResponsive());
      expect(result.current.isTablet).toBe(true);
      expect(result.current.layoutMode).toBe('tablet');
    });

    it('handles exact desktop boundary (900px)', () => {
      Object.defineProperty(window, 'innerWidth', { value: 900, configurable: true });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: createMatchMediaMock({
          [`(max-width: ${BREAKPOINTS.MD - 1}px)`]: false,
          [`(min-width: ${BREAKPOINTS.MD}px) and (max-width: ${BREAKPOINTS.LG - 1}px)`]: false,
          [`(min-width: ${BREAKPOINTS.LG}px)`]: true,
          '(pointer: coarse)': false,
          '(orientation: landscape)': true,
        }),
      });

      const { result } = renderHook(() => useResponsive());
      expect(result.current.isDesktop).toBe(true);
      expect(result.current.layoutMode).toBe('desktop');
    });
  });
});

describe('prefersTouch', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it('returns true when pointer: coarse matches', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: () => ({ matches: true }),
    });

    expect(prefersTouch()).toBe(true);
  });

  it('returns false when pointer: coarse does not match', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: () => ({ matches: false }),
    });

    expect(prefersTouch()).toBe(false);
  });
});
