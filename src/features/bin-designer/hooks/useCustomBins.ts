/**
 * Hook for reading available custom bin designs from the registry.
 *
 * Used by the Layout Planner to populate the custom bin palette.
 * Reads from the lightweight localStorage registry (not IndexedDB)
 * for fast synchronous access.
 */

import { useSyncExternalStore } from 'react';
import { loadRegistry, subscribeToRegistry, type CustomBinRef } from '../store/customBinRegistry';

// useSyncExternalStore requires referentially stable snapshots between notifications.
// `cachedRegistry` is only reassigned inside `notifyAll` (or on the 0→1 subscriber
// transition, when no consumer can observe the change yet).
let cachedRegistry: CustomBinRef[] = loadRegistry();
const subscribers = new Set<() => void>();

function notifyAll(): void {
  cachedRegistry = loadRegistry();
  subscribers.forEach((cb) => cb());
}

subscribeToRegistry(notifyAll);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'gridfinity-custom-bins-v1' || e.key === null) {
      notifyAll();
    }
  });
}

function subscribe(callback: () => void): () => void {
  // Catches registry writes that landed while nothing was subscribed.
  if (subscribers.size === 0) {
    cachedRegistry = loadRegistry();
  }
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

function getSnapshot(): CustomBinRef[] {
  return cachedRegistry;
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
