/**
 * Hook for reading available custom bin designs from the registry.
 *
 * Used by the Layout Planner to populate the custom bin palette.
 * Reads from the lightweight localStorage registry (not IndexedDB)
 * for fast synchronous access.
 */

import { useSyncExternalStore } from 'react';
import { loadRegistry, subscribeToRegistry, type CustomBinRef } from '../store/customBinRegistry';

// Cache the registry result to prevent useSyncExternalStore infinite loops
let cachedRegistry: CustomBinRef[] = loadRegistry();

// Track subscribers for storage event notifications
const storageSubscribers = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  // Refresh cache on subscribe to catch any updates that happened
  // before this hook instance mounted (e.g., upsertRegistryEntry called
  // while no hooks were active)
  cachedRegistry = loadRegistry();

  // Subscribe to registry changes (same-tab updates)
  const unsubscribeRegistry = subscribeToRegistry(() => {
    cachedRegistry = loadRegistry();
    callback();
  });

  // Also track for storage events (cross-tab updates)
  storageSubscribers.add(callback);

  return () => {
    unsubscribeRegistry();
    storageSubscribers.delete(callback);
  };
}

function getSnapshot(): CustomBinRef[] {
  // Return cached value - useSyncExternalStore expects referential stability
  return cachedRegistry;
}

// Listen for storage events from other tabs
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'gridfinity-custom-bins-v1' || e.key === null) {
      cachedRegistry = loadRegistry();
      storageSubscribers.forEach((cb) => cb());
    }
  });
}

/**
 * Provide the current list of available custom bin designs from the registry.
 *
 * Uses useSyncExternalStore for safe external data access. Automatically
 * updates when the registry changes via upsertRegistryEntry, removeRegistryEntry,
 * or rebuildRegistry.
 *
 * @returns An array of `CustomBinRef` representing available custom bin designs.
 */
export function useCustomBins(): CustomBinRef[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Reset the cache to current localStorage state. Used by tests after
 * localStorage.clear() to ensure clean state.
 * @internal
 */
export function resetCustomBinsCache(): void {
  cachedRegistry = loadRegistry();
}
