/**
 * Hook for reading available custom bin designs from the registry.
 *
 * Used by the Layout Planner to populate the custom bin palette.
 * Reads from the lightweight localStorage registry (not IndexedDB)
 * for fast synchronous access.
 */

import { useState, useEffect } from 'react';
import { loadRegistry, type CustomBinRef } from '../store/customBinRegistry';

/**
 * Returns the list of available custom bin designs from the registry.
 * Re-reads on mount (which happens when navigating back from the designer).
 */
export function useCustomBins(): CustomBinRef[] {
  const [bins, setBins] = useState<CustomBinRef[]>(() => loadRegistry());

  useEffect(() => {
    // Re-read on mount (covers navigation from designer back to planner)
    setBins(loadRegistry());
  }, []);

  return bins;
}
