/**
 * Hook to automatically sync owned shared layouts to Blob storage.
 *
 * When the owner edits a layout that has an active cloud share, this hook
 * ensures changes are persisted to Blob storage (not just localStorage).
 * This keeps the shared version up-to-date for collaborators.
 *
 * This runs independently of CollabProvider - the owner doesn't need to be
 * in "collab mode" for their changes to sync. This makes the app behave
 * like Google Docs where the shared version is always current.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore } from '../store/layout';
import { useLibraryStore } from '../store/library';
import { updateShare } from '../api/share';
import { isOk } from '../result';
import { STAGING_ID } from '../constants';
import type { CloudShareInfo } from '../types';

/** Debounce delay for cloud share updates (5 seconds) */
const CLOUD_SYNC_DEBOUNCE_MS = 5000;

/**
 * Syncs owned shared layouts to Blob storage when edited locally.
 *
 * This ensures collaborators always see the latest version when they open
 * a share link, even if the owner is editing outside of collab mode.
 */
export function useOwnedShareSync(): void {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedRef = useRef<string | null>(null);
  const isSyncingRef = useRef(false);
  // Track cloud share info in a ref to avoid stale closures in cleanup
  const cloudShareRef = useRef<CloudShareInfo | null>(null);
  // Track sync function in a ref to always call the latest version
  const syncToCloudRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const { layout, activeLayoutId, lastEditSource } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      activeLayoutId: state.activeLayoutId,
      lastEditSource: state.lastEditSource,
    }))
  );

  const entries = useLibraryStore((state) => state.library.entries);

  // Find cloudShare info for the active layout
  const cloudShare = entries.find((e) => e.id === activeLayoutId)?.cloudShare ?? null;

  // Keep ref in sync with current cloudShare value
  cloudShareRef.current = cloudShare;

  const syncToCloud = useCallback(async () => {
    if (!cloudShare || isSyncingRef.current) return;

    const { id: shareId, deleteToken } = cloudShare;
    if (!shareId || !deleteToken) return;

    // Create a fingerprint of the current layout for comparison
    const layoutFingerprint = JSON.stringify({
      bins: layout.bins.filter((b) => b.layerId !== STAGING_ID),
      layers: layout.layers,
      categories: layout.categories,
      drawer: layout.drawer,
      name: layout.name,
    });

    // Skip if nothing changed since last sync
    if (layoutFingerprint === lastSyncedRef.current) return;

    isSyncingRef.current = true;

    try {
      const result = await updateShare(shareId, deleteToken, layout);

      if (isOk(result)) {
        lastSyncedRef.current = layoutFingerprint;
      }
      // Silently ignore failures - this is background sync
    } catch {
      // Silently ignore network errors
    } finally {
      isSyncingRef.current = false;
    }
  }, [cloudShare, layout]);

  // Keep sync function ref updated to always call the latest version
  syncToCloudRef.current = syncToCloud;

  // Debounced sync effect
  useEffect(() => {
    // Only sync if:
    // 1. Layout has an active cloud share
    // 2. This is a local edit (not init or remote sync)
    // 3. Not viewing a shared preview
    if (!cloudShare) return;
    if (lastEditSource !== 'local') return;
    if (activeLayoutId === '__shared_preview__') return;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Schedule new sync
    debounceTimerRef.current = setTimeout(() => {
      syncToCloud();
    }, CLOUD_SYNC_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [cloudShare, layout, lastEditSource, activeLayoutId, syncToCloud]);

  // Sync on unmount (navigating away, closing tab)
  // Use refs to avoid stale closures - cloudShare might be null by cleanup time
  useEffect(() => {
    return () => {
      if (cloudShareRef.current && debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        // Fire-and-forget sync before unmount using the latest sync function
        syncToCloudRef.current();
      }
    };
  }, []); // Empty deps - refs provide current values
}
