import { useState, useEffect, useRef } from 'react';
import { BREAKPOINTS } from '../../core/constants';

export type LayoutMode = 'mobile' | 'tablet' | 'desktop';

export interface ResponsiveState {
  /** Screen width < 768px */
  isMobile: boolean;
  /** Screen width 768-899px */
  isTablet: boolean;
  /** Screen width >= 900px */
  isDesktop: boolean;
  /** Device has touch capability (coarse pointer) */
  isTouchDevice: boolean;
  /** Current layout mode based on viewport */
  layoutMode: LayoutMode;
  /** Viewport width in pixels */
  viewportWidth: number;
  /** Viewport height in pixels */
  viewportHeight: number;
  /** Device is in landscape orientation (width > height) */
  isLandscape: boolean;
}

// Debounce delay for resize events (ms)
// This improves INP by reducing state updates during continuous resize
const RESIZE_DEBOUNCE_MS = 100;

/**
 * Hook for responsive breakpoint detection and touch capability.
 * Uses matchMedia for efficient breakpoint updates without resize event spam.
 * Resize events are debounced to improve INP during window resizing.
 */
export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => getResponsiveState());
  const resizeTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Media queries for breakpoints - these fire only when crossing thresholds
    const mobileQuery = window.matchMedia(`(max-width: ${BREAKPOINTS.MD - 1}px)`);
    const tabletQuery = window.matchMedia(
      `(min-width: ${BREAKPOINTS.MD}px) and (max-width: ${BREAKPOINTS.LG - 1}px)`
    );
    const desktopQuery = window.matchMedia(`(min-width: ${BREAKPOINTS.LG}px)`);
    const touchQuery = window.matchMedia('(pointer: coarse)');
    const landscapeQuery = window.matchMedia('(orientation: landscape)');

    // Immediate update for breakpoint changes (these are already efficient)
    const updateState = () => {
      setState(getResponsiveState());
    };

    // Debounced update for resize events (only affects viewportWidth/Height)
    // This prevents excessive re-renders during continuous resize dragging
    const debouncedResizeHandler = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = window.setTimeout(() => {
        setState(getResponsiveState());
      }, RESIZE_DEBOUNCE_MS);
    };

    // Listen for changes - matchMedia handlers fire immediately (efficient)
    mobileQuery.addEventListener('change', updateState);
    tabletQuery.addEventListener('change', updateState);
    desktopQuery.addEventListener('change', updateState);
    touchQuery.addEventListener('change', updateState);
    landscapeQuery.addEventListener('change', updateState);

    // Debounce resize events for viewport dimension updates
    window.addEventListener('resize', debouncedResizeHandler);

    // Initial state
    updateState();

    return () => {
      mobileQuery.removeEventListener('change', updateState);
      tabletQuery.removeEventListener('change', updateState);
      desktopQuery.removeEventListener('change', updateState);
      touchQuery.removeEventListener('change', updateState);
      landscapeQuery.removeEventListener('change', updateState);
      window.removeEventListener('resize', debouncedResizeHandler);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  return state;
}

/**
 * Get current responsive state from window.
 */
function getResponsiveState(): ResponsiveState {
  if (typeof window === 'undefined') {
    // SSR fallback - assume desktop
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      layoutMode: 'desktop',
      viewportWidth: 1280,
      viewportHeight: 720,
      isLandscape: true,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const isMobile = width < BREAKPOINTS.MD;
  const isTablet = width >= BREAKPOINTS.MD && width < BREAKPOINTS.LG;
  const isDesktop = width >= BREAKPOINTS.LG;
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  const isLandscape = width > height;

  let layoutMode: LayoutMode = 'desktop';
  if (isMobile) {
    layoutMode = 'mobile';
  } else if (isTablet) {
    layoutMode = 'tablet';
  }

  return {
    isMobile,
    isTablet,
    isDesktop,
    isTouchDevice,
    layoutMode,
    viewportWidth: width,
    viewportHeight: height,
    isLandscape,
  };
}

/**
 * Utility to check if current device prefers touch input.
 * Can be used for conditional rendering of touch-specific UI.
 */
export function prefersTouch(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}
