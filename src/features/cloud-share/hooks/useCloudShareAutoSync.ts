/**
 * Hook to automatically sync layout changes to cloud share storage.
 *
 * In collaborative mode, changes go to Liveblocks for real-time sync.
 * This hook ensures those changes are also persisted to Vercel Blob
 * so that new viewers get the latest layout data.
 *
 * Any collaborator can trigger the sync since the deleteToken is shared
 * via Liveblocks storage by the owner.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useStorage } from '@/liveblocks.config';
import { useLayoutStore } from '@/core/store/layout';
import { updateShare } from '@/core/api/share';
import { isOk } from '@/core/result';
import { createLayoutFingerprint } from '@/features/cloud-share/utils';

/** Debounce delay for cloud share updates (1 second) */
const CLOUD_SYNC_DEBOUNCE_MS = 1000;

/**
 * Auto-syncs layout changes to cloud share storage.
 *
 * Reads the deleteToken from Liveblocks storage (set by owner) so any
 * collaborator can persist changes to Vercel Blob.
 *
 * @param shareId - The cloud share ID to sync to
 * @param enabled - Whether auto-sync is enabled (should be true in collab mode)
 */
export function useCloudShareAutoSync(shareId: string | null, enabled: boolean): void {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedRef = useRef<string | null>(null);
  const isSyncingRef = useRef(false);

  const layout = useLayoutStore((state) => state.layout);
  const lastEditSource = useLayoutStore((state) => state.lastEditSource);

  // Get deleteToken from Liveblocks storage (shared by owner)
  const deleteToken = useStorage((root) => root?.metadata?.deleteToken) as string | undefined;

  const syncToCloud = useCallback(async () => {
    if (!shareId || !deleteToken || isSyncingRef.current) return;

    // Set syncing flag immediately to prevent race conditions
    isSyncingRef.current = true;

    const layoutFingerprint = createLayoutFingerprint(layout);

    // Skip if nothing changed since last sync
    if (layoutFingerprint === lastSyncedRef.current) {
      isSyncingRef.current = false;
      return;
    }

    try {
      const result = await updateShare(shareId, deleteToken, layout);

      if (isOk(result)) {
        lastSyncedRef.current = layoutFingerprint;
      }
      // Silently ignore failures - this is background sync, user isn't waiting
    } catch {
      // Silently ignore network errors
    } finally {
      isSyncingRef.current = false;
    }
  }, [shareId, deleteToken, layout]);

  // Debounced sync effect
  useEffect(() => {
    if (!enabled || !shareId || !deleteToken) return;

    // Only sync local edits (from collaborative mutations)
    // Don't sync 'init' or 'remote' changes
    if (lastEditSource !== 'local') return;

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
  }, [enabled, shareId, deleteToken, layout, lastEditSource, syncToCloud]);

  // Sync on unmount (collaborator leaving the session)
  useEffect(() => {
    return () => {
      if (enabled && shareId && deleteToken && debounceTimerRef.current) {
        // Clear pending timer and do immediate sync
        clearTimeout(debounceTimerRef.current);
        // Note: Can't await in cleanup, but fire-and-forget is acceptable here
        syncToCloud();
      }
    };
  }, [enabled, shareId, deleteToken, syncToCloud]);
}
