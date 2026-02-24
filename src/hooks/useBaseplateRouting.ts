/**
 * Baseplate routing hook.
 *
 * Manages navigation between Layout Planner (/) and Baseplate Generator (/baseplate).
 * Supports layoutId in URL query params (/baseplate?layoutId=abc) for:
 * - Deep linking to baseplates for a specific layout
 * - Browser back/forward navigation
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Check if the current URL is the baseplate route.
 */
function isBaseplatePath(): boolean {
  return window.location.pathname === '/baseplate' || window.location.pathname === '/baseplate/';
}

/**
 * Extract layoutId from URL search params.
 * Returns null if not on baseplate route or no layoutId param present.
 */
function getLayoutIdFromUrl(): string | null {
  if (!isBaseplatePath()) return null;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('layoutId');
}

/**
 * Hook that manages baseplate route detection and navigation.
 */
export function useBaseplateRouting() {
  const [isBaseplateRoute, setIsBaseplateRoute] = useState(isBaseplatePath);
  const [layoutIdFromUrl, setLayoutIdFromUrl] = useState<string | null>(getLayoutIdFromUrl);

  useEffect(() => {
    const handlePopState = () => {
      setIsBaseplateRoute(isBaseplatePath());
      setLayoutIdFromUrl(getLayoutIdFromUrl());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  /**
   * Navigate to the baseplate page for a specific layout.
   */
  const navigateToBaseplate = useCallback((layoutId: string) => {
    const url = `/baseplate?layoutId=${encodeURIComponent(layoutId)}`;
    window.history.pushState({ layoutId }, '', url);
    setIsBaseplateRoute(true);
    setLayoutIdFromUrl(layoutId);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  /**
   * Navigate back to the Layout Planner.
   */
  const navigateBack = useCallback(() => {
    window.history.pushState(null, '', '/');
    setIsBaseplateRoute(false);
    setLayoutIdFromUrl(null);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  return {
    isBaseplateRoute,
    /** The layout ID parsed from the current URL */
    layoutIdFromUrl,
    navigateToBaseplate,
    navigateBack,
  };
}
