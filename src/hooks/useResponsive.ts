import { useState, useEffect } from 'react';

// Breakpoint values in pixels
export const BREAKPOINTS = {
  sm: 640,   // Small phones
  md: 768,   // Large phones / small tablets
  lg: 900,   // Small desktop (narrower persistent sidebars)
  xl: 1280,  // Full desktop
} as const;

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
}

/**
 * Hook for responsive breakpoint detection and touch capability.
 * Uses matchMedia for efficient updates without resize event spam.
 */
export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => getResponsiveState());

  useEffect(() => {
    // Media queries for breakpoints
    const mobileQuery = window.matchMedia(`(max-width: ${BREAKPOINTS.md - 1}px)`);
    const tabletQuery = window.matchMedia(
      `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`
    );
    const desktopQuery = window.matchMedia(`(min-width: ${BREAKPOINTS.lg}px)`);
    const touchQuery = window.matchMedia('(pointer: coarse)');

    const updateState = () => {
      setState(getResponsiveState());
    };

    // Listen for changes
    mobileQuery.addEventListener('change', updateState);
    tabletQuery.addEventListener('change', updateState);
    desktopQuery.addEventListener('change', updateState);
    touchQuery.addEventListener('change', updateState);

    // Initial state
    updateState();

    return () => {
      mobileQuery.removeEventListener('change', updateState);
      tabletQuery.removeEventListener('change', updateState);
      desktopQuery.removeEventListener('change', updateState);
      touchQuery.removeEventListener('change', updateState);
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
    };
  }

  const width = window.innerWidth;
  const isMobile = width < BREAKPOINTS.md;
  const isTablet = width >= BREAKPOINTS.md && width < BREAKPOINTS.lg;
  const isDesktop = width >= BREAKPOINTS.lg;
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

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
