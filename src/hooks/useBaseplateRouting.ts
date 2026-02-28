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
 * Check if the current URL indicates standalone mode.
 * Returns true when on /baseplate with ?standalone=1.
 */
function getStandaloneFromUrl(): boolean {
  if (!isBaseplatePath()) return false;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('standalone') === '1';
}

/**
 * Hook that manages baseplate route detection and navigation.
 */
export function useBaseplateRouting() {
  const [isBaseplateRoute, setIsBaseplateRoute] = useState(isBaseplatePath);
  const [layoutIdFromUrl, setLayoutIdFromUrl] = useState<string | null>(getLayoutIdFromUrl);
  const [isStandalone, setIsStandalone] = useState(getStandaloneFromUrl);

  useEffect(() => {
    const handlePopState = () => {
      setIsBaseplateRoute(isBaseplatePath());
      setLayoutIdFromUrl(getLayoutIdFromUrl());
      setIsStandalone(getStandaloneFromUrl());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  /**
   * Navigate to the baseplate page, optionally for a specific layout.
   * When no layoutId is provided, navigates to /baseplate without query params.
   */
  const navigateToBaseplate = useCallback((layoutId?: string) => {
    const url = layoutId ? `/baseplate?layoutId=${encodeURIComponent(layoutId)}` : '/baseplate';
    window.history.pushState(layoutId ? { layoutId } : null, '', url);
    setIsBaseplateRoute(true);
    setLayoutIdFromUrl(layoutId ?? null);
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
    /** Whether the page was opened in standalone mode (?standalone=1) */
    isStandalone,
    navigateToBaseplate,
    navigateBack,
  };
}
