/**
 * Hook for loading bin design thumbnails from IndexedDB on demand.
 *
 * Thumbnails are stored only in IndexedDB (not localStorage) to avoid
 * quota pressure. This hook loads them asynchronously with an in-memory
 * cache to avoid redundant reads.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { loadDesign } from '../storage/DesignerStorage';
import { isOk } from '@/core/result';
import { designId as toDesignId } from '@/core/types';

/** In-memory cache: designId → thumbnail string | null */
const thumbnailCache = new Map<string, string | null>();

/** Subscribers notified when the cache changes */
const cacheSubscribers = new Set<() => void>();

/** Monotonic version counter — incremented on every cache mutation */
let cacheVersion = 0;

function notifyCacheSubscribers(): void {
  cacheVersion += 1;
  cacheSubscribers.forEach((cb) => cb());
}

function subscribeToCacheChanges(callback: () => void): () => void {
  cacheSubscribers.add(callback);
  return () => cacheSubscribers.delete(callback);
}

function getCacheVersion(): number {
  return cacheVersion;
}

interface UseDesignThumbnailResult {
  thumbnail: string | null;
  isLoading: boolean;
}

/**
 * Load a design's thumbnail from IndexedDB with in-memory caching.
 *
 * Uses useSyncExternalStore to subscribe to cache changes, avoiding
 * synchronous setState calls inside effects.
 *
 * @param designId - The design ID, or undefined to skip loading
 * @returns The thumbnail data URL and loading state
 */
export function useDesignThumbnail(designId: string | undefined): UseDesignThumbnailResult {
  // Subscribe to cache version changes (returns a scalar, so referentially stable)
  useSyncExternalStore(subscribeToCacheChanges, getCacheVersion, getCacheVersion);

  // Derive thumbnail from cache (re-evaluated when cacheVersion changes)
  const isCached = designId !== undefined && thumbnailCache.has(designId);
  const thumbnail = isCached ? (thumbnailCache.get(designId) ?? null) : null;
  const isLoading = designId !== undefined && !isCached;

  // Trigger async fetch when designId is not cached
  useEffect(() => {
    if (!designId || thumbnailCache.has(designId)) return;

    let cancelled = false;

    void loadDesign(toDesignId(designId)).then((loadResult) => {
      if (cancelled) return;
      const thumb = isOk(loadResult) ? (loadResult.value.thumbnail ?? null) : null;
      thumbnailCache.set(designId, thumb);
      notifyCacheSubscribers();
    });

    return () => {
      cancelled = true;
    };
  }, [designId]);

  return { thumbnail, isLoading };
}

/**
 * Clear the in-memory thumbnail cache. Call when designs are updated
 * or for testing.
 */
export function clearThumbnailCache(): void {
  thumbnailCache.clear();
  notifyCacheSubscribers();
}

/**
 * Update a single entry in the thumbnail cache.
 * Call after saving/regenerating a thumbnail to keep the cache fresh.
 */
export function updateThumbnailCache(designId: string, thumbnail: string | null): void {
  thumbnailCache.set(designId, thumbnail);
  notifyCacheSubscribers();
}
