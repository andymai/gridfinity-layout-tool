/**
 * Designer routing hook.
 *
 * Manages navigation between Layout Planner (/) and Bin Designer (/designer).
 * Supports design IDs in URL query params (/designer?id=abc123) for:
 * - Deep linking to specific designs
 * - Browser back/forward navigation between designs
 * - Bookmarkable design URLs
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Check if the current URL is the designer route.
 */
function isDesignerPath(): boolean {
  return window.location.pathname === '/designer' || window.location.pathname === '/designer/';
}

/**
 * Extract design ID from URL search params.
 * Returns null if not on designer route or no id param present.
 */
function getDesignIdFromUrl(): string | null {
  if (!isDesignerPath()) return null;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
}

/**
 * Build designer URL with optional design ID.
 */
function buildDesignerUrl(designId?: string | null): string {
  if (designId) {
    return `/designer?id=${encodeURIComponent(designId)}`;
  }
  return '/designer';
}

/**
 * Hook that manages designer route detection and navigation.
 *
 * Returns `designIdFromUrl` which updates on popstate events,
 * allowing components to load the indicated design from storage.
 */
export function useDesignerRouting() {
  const [isDesignerRoute, setIsDesignerRoute] = useState(isDesignerPath);
  const [designIdFromUrl, setDesignIdFromUrl] = useState<string | null>(getDesignIdFromUrl);

  useEffect(() => {
    const handlePopState = () => {
      setIsDesignerRoute(isDesignerPath());
      setDesignIdFromUrl(getDesignIdFromUrl());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  /**
   * Navigate to the designer (new/blank design).
   */
  const navigateToDesigner = useCallback(() => {
    window.history.pushState({ designId: null }, '', '/designer');
    setIsDesignerRoute(true);
    setDesignIdFromUrl(null);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  /**
   * Navigate to a specific design (creates history entry for back/forward).
   * Call this when the user explicitly switches designs (e.g., from design list).
   */
  const navigateToDesign = useCallback((designId: string) => {
    const url = buildDesignerUrl(designId);
    window.history.pushState({ designId }, '', url);
    setIsDesignerRoute(true);
    setDesignIdFromUrl(designId);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  /**
   * Update URL to reflect current design ID without creating a history entry.
   * Call this after auto-save creates a new design ID, so the URL stays in sync
   * but doesn't pollute the back/forward stack.
   */
  const syncUrlToDesign = useCallback((designId: string | null) => {
    if (!isDesignerPath()) return;
    const url = buildDesignerUrl(designId);
    window.history.replaceState({ designId }, '', url);
    setDesignIdFromUrl(designId);
  }, []);

  /**
   * Navigate back to the Layout Planner.
   */
  const navigateToPlanner = useCallback(() => {
    window.history.pushState(null, '', '/');
    setIsDesignerRoute(false);
    setDesignIdFromUrl(null);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  return {
    isDesignerRoute,
    /** The design ID parsed from the current URL (null = new design) */
    designIdFromUrl,
    navigateToDesigner,
    navigateToDesign,
    navigateToPlanner,
    syncUrlToDesign,
  };
}