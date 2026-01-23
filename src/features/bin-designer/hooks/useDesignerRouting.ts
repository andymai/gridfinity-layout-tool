/**
 * Designer routing hook.
 *
 * Detects /designer pathname and provides navigation between
 * the Layout Planner (/) and Bin Designer (/designer).
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Check if the current URL is the designer route.
 */
function isDesignerPath(): boolean {
  return window.location.pathname === '/designer' || window.location.pathname === '/designer/';
}

/**
 * Hook that manages designer route detection and navigation.
 */
export function useDesignerRouting() {
  const [isDesignerRoute, setIsDesignerRoute] = useState(isDesignerPath);

  useEffect(() => {
    const handlePopState = () => {
      setIsDesignerRoute(isDesignerPath());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToDesigner = useCallback(() => {
    window.history.pushState(null, '', '/designer');
    // Dispatch popstate so all hook instances re-check the URL
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  const navigateToPlanner = useCallback(() => {
    window.history.pushState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  return {
    isDesignerRoute,
    navigateToDesigner,
    navigateToPlanner,
  };
}
