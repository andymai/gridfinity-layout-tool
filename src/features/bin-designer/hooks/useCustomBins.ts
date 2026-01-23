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
 * Provide the current list of available custom bin designs from the registry.
 *
 * The list is seeded from the registry and refreshed once when the component mounts.
 *
 * @returns An array of `CustomBinRef` representing available custom bin designs.
 */
export function useCustomBins(): CustomBinRef[] {
  const [bins, setBins] = useState<CustomBinRef[]>(() => loadRegistry());

  useEffect(() => {
    // Re-read on mount (covers navigation from designer back to planner)
    setBins(loadRegistry());
  }, []);

  return bins;
}