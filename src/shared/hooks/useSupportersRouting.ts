/**
 * Supporters routing hook.
 *
 * Detects the /supporters route and provides navigation to/from it.
 * Mirrors useBaseplateRouting but takes no query params.
 */

import { useState, useEffect, useCallback } from 'react';

function isSupportersPath(): boolean {
  return window.location.pathname === '/supporters' || window.location.pathname === '/supporters/';
}

export function useSupportersRouting() {
  const [isSupportersRoute, setIsSupportersRoute] = useState(isSupportersPath);

  useEffect(() => {
    const handlePopState = () => setIsSupportersRoute(isSupportersPath());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToSupporters = useCallback(() => {
    window.history.pushState(null, '', '/supporters');
    setIsSupportersRoute(true);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  const navigateHome = useCallback(() => {
    window.history.pushState(null, '', '/');
    setIsSupportersRoute(false);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  return { isSupportersRoute, navigateToSupporters, navigateHome };
}
