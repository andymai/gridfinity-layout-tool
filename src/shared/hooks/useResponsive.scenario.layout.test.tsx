import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useResponsive, type ResponsiveState } from '@/shared/hooks';
import { renderHook } from '@testing-library/react';

// Mock matchMedia
const createMatchMedia = (matches: Record<string, boolean>) => {
  return vi.fn().mockImplementation((query: string) => ({
    matches: matches[query] ?? false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

describe('Responsive Layout Switching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useResponsive hook', () => {
    it('detects mobile viewport (< 768px)', () => {
      // useResponsive uses window.innerWidth directly for viewport detection
      Object.defineProperty(window, 'innerWidth', {
        value: 375,
        writable: true,
      });

      window.matchMedia = createMatchMedia({
        '(pointer: coarse)': true,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(false);
      expect(result.current.layoutMode).toBe('mobile');
    });

    it('detects tablet viewport (768px - 899px)', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 850,
        writable: true,
      });

      window.matchMedia = createMatchMedia({
        '(pointer: coarse)': true,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isDesktop).toBe(false);
      expect(result.current.layoutMode).toBe('tablet');
    });

    it('detects desktop viewport (>= 1024px)', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 1200,
        writable: true,
      });

      window.matchMedia = createMatchMedia({
        '(pointer: coarse)': false,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(true);
      expect(result.current.layoutMode).toBe('desktop');
    });

    it('detects touch device via pointer: coarse', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 1200,
        writable: true,
      });

      window.matchMedia = createMatchMedia({
        '(pointer: coarse)': true,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isTouchDevice).toBe(true);
    });

    it('detects non-touch device via pointer: fine', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 1200,
        writable: true,
      });

      window.matchMedia = createMatchMedia({
        '(pointer: coarse)': false,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isTouchDevice).toBe(false);
    });
  });

  describe('Layout mode determination', () => {
    it('returns mobile layout mode for small screens', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 375,
        writable: true,
      });

      window.matchMedia = createMatchMedia({
        '(pointer: coarse)': true,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.layoutMode).toBe('mobile');
    });

    it('returns tablet layout mode for medium screens', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 850,
        writable: true,
      });

      window.matchMedia = createMatchMedia({
        '(pointer: coarse)': false,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.layoutMode).toBe('tablet');
    });

    it('returns desktop layout mode for large screens', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 1200,
        writable: true,
      });

      window.matchMedia = createMatchMedia({
        '(pointer: coarse)': false,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.layoutMode).toBe('desktop');
    });
  });

  describe('Viewport width tracking', () => {
    it('returns viewport width', () => {
      // Set initial window width
      Object.defineProperty(window, 'innerWidth', {
        value: 1200,
        writable: true,
      });

      window.matchMedia = createMatchMedia({
        '(max-width: 767px)': false,
        '(min-width: 768px) and (max-width: 1023px)': false,
        '(pointer: coarse)': false,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.viewportWidth).toBe(1200);
    });

    it('returns mobile viewport width', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 375,
        writable: true,
      });

      window.matchMedia = createMatchMedia({
        '(pointer: coarse)': true,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.viewportWidth).toBe(375);
    });

    it('returns tablet viewport width', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 850,
        writable: true,
      });

      window.matchMedia = createMatchMedia({
        '(pointer: coarse)': true,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.viewportWidth).toBe(850);
    });
  });

  describe('Return type structure', () => {
    it('returns all expected properties', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 1200,
        writable: true,
      });

      window.matchMedia = createMatchMedia({
        '(pointer: coarse)': false,
      });

      const { result } = renderHook(() => useResponsive());

      // Check that all expected properties exist
      const responsiveResult: ResponsiveState = result.current;
      expect(typeof responsiveResult.isMobile).toBe('boolean');
      expect(typeof responsiveResult.isTablet).toBe('boolean');
      expect(typeof responsiveResult.isDesktop).toBe('boolean');
      expect(typeof responsiveResult.isTouchDevice).toBe('boolean');
      expect(['mobile', 'tablet', 'desktop']).toContain(responsiveResult.layoutMode);
      expect(typeof responsiveResult.viewportWidth).toBe('number');
    });
  });
});
