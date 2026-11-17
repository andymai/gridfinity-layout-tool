/**
 * Detects the /labels route: the label maker on its own page, for people who
 * want labels without a layout. Mirrors useSupportersRouting.
 */

import { useEffect, useState } from 'react';

function isLabelsPath(): boolean {
  return window.location.pathname === '/labels' || window.location.pathname === '/labels/';
}

export function useLabelsRouting(): { isLabelsRoute: boolean } {
  const [isLabelsRoute, setIsLabelsRoute] = useState(isLabelsPath);

  useEffect(() => {
    const handlePopState = () => setIsLabelsRoute(isLabelsPath());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return { isLabelsRoute };
}
