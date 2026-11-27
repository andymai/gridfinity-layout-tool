import { useCallback, useEffect, useState } from 'react';
import { dispatchSyntheticPopstate } from './useDesignerRouting';

function isYour2026Path(): boolean {
  return window.location.pathname === '/your-2026' || window.location.pathname === '/your-2026/';
}

export function useYour2026Routing() {
  const [isYour2026Route, setIsYour2026Route] = useState(isYour2026Path);

  useEffect(() => {
    const handlePopState = () => setIsYour2026Route(isYour2026Path());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToYour2026 = useCallback((search = '') => {
    window.history.pushState(null, '', `/your-2026${search}`);
    setIsYour2026Route(true);
    dispatchSyntheticPopstate();
  }, []);

  const navigateHome = useCallback(() => {
    window.history.pushState(null, '', '/');
    setIsYour2026Route(false);
    dispatchSyntheticPopstate();
  }, []);

  return { isYour2026Route, navigateToYour2026, navigateHome };
}
