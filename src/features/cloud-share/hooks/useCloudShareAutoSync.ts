/**
 * Hook to save a collab room's layout to its cloud share.
 *
 * In collaborative mode, changes go to Liveblocks for real-time sync.
 * This hook persists the room's layout to Vercel Blob, whoever changed it,
 * so that new viewers get the latest layout data.
 *
 * Only the share owner can trigger the sync — the delete token is passed
 * from the owner's local library store and is never stored in Liveblocks
 * shared storage where collaborators could read it.
 */

import { useEffect, useRef, useState } from 'react';
import { useMutation, useStorage, type LiveblocksStorage } from '@/liveblocks.config';
import { updateShare } from '@/core/api/share';
import { isOk } from '@/core/result';
import { claimRoomSaves } from '@/features/cloud-share/utils';
import {
  isLaterRevision,
  roomLayoutFingerprint,
  type RoomLinkStamp,
} from '@/shared/utils/roomLinkStamp';

/** Debounce delay for cloud share updates (1 second) */
const CLOUD_SYNC_DEBOUNCE_MS = 1000;

interface RoomUpload {
  /** The share and the fingerprint of the layout that the upload saves. */
  readonly key: string;
  readonly run: () => Promise<void>;
}

/**
 * Runs one upload at a time and keeps only the latest request that waits. A
 * request that matches the upload in flight replaces nothing: the room went
 * back to what is already on its way. The queue outlives the room, so a
 * change that waits when the owner leaves still uploads.
 */
function createUploadQueue(): (upload: RoomUpload) => void {
  let inFlight: string | null = null;
  let waiting: RoomUpload | null = null;
  const start = (upload: RoomUpload): void => {
    if (inFlight !== null) {
      waiting = upload.key === inFlight ? null : upload;
      return;
    }
    inFlight = upload.key;
    void upload.run().finally(() => {
      inFlight = null;
      const next = waiting;
      waiting = null;
      if (next) start(next);
    });
  };
  return start;
}

/**
 * Saves the room's layout to the share whenever it differs from what the room
 * last recorded as saved, then records the save in the room. The record lives
 * in the room, not in this browser. When the owner opens a room whose edits
 * are already on the link, nothing uploads. Edits that people made while the
 * owner was away upload on the owner's next visit.
 *
 * Only runs when deleteToken is defined (i.e., for the share owner).
 * Non-owners receive undefined and this hook becomes a no-op.
 *
 * @param shareId - The cloud share ID to sync to
 * @param deleteToken - The owner's delete token from their local library store.
 *   Pass undefined for non-owners to disable sync.
 */
export function useCloudShareAutoSync(
  shareId: string | null,
  deleteToken: string | undefined
): void {
  const roomLayout = useStorage((root) => root.layout);
  const linkFingerprint = useStorage((root) => root.metadata?.linkFingerprint);

  const [enqueueUpload] = useState(createUploadQueue);
  const mountedShareIdRef = useRef<string | null>(null);
  const pendingSaveRef = useRef<(() => void) | null>(null);

  const recordSave = useMutation(({ storage, self }, saved: RoomLinkStamp): void => {
    if (!self.canWrite) return;
    const metadata = storage.get('metadata') as LiveblocksStorage['metadata'] | undefined;
    // Two tabs of the owner can both save; the link keeps the later write.
    if (isLaterRevision(metadata?.linkUpdatedAt, saved.linkUpdatedAt)) return;
    storage.set('metadata', { ...metadata, ...saved });
  }, []);

  useEffect(() => {
    mountedShareIdRef.current = shareId;
    return () => {
      mountedShareIdRef.current = null;
    };
  }, [shareId]);

  const roomLoaded = Boolean(roomLayout);
  useEffect(() => {
    if (!shareId || !deleteToken || !roomLoaded) return;
    return claimRoomSaves(shareId);
  }, [shareId, deleteToken, roomLoaded]);

  useEffect(() => {
    pendingSaveRef.current = null;
    if (!shareId || !deleteToken || !roomLayout) return;

    const fingerprint = roomLayoutFingerprint(roomLayout);
    // The room's record is the only "already saved" signal: another owner tab
    // can save a different layout after this one, which a per-tab memory misses.
    if (fingerprint === linkFingerprint) return;

    const save = (): void => {
      pendingSaveRef.current = null;
      enqueueUpload({
        key: `${shareId}:${fingerprint}`,
        run: () =>
          updateShare(shareId, deleteToken, roomLayout)
            .then((result) => {
              // Silently ignore failures - this is background sync, user isn't waiting
              if (!isOk(result)) return;
              // A save that lands after the owner left the room must not stamp another room.
              if (mountedShareIdRef.current !== shareId) return;
              const { lastUpdatedAt } = result.value;
              recordSave({
                linkFingerprint: fingerprint,
                ...(lastUpdatedAt ? { linkUpdatedAt: lastUpdatedAt } : {}),
              });
            })
            .catch(() => {
              // Silently ignore network errors
            }),
      });
    };
    pendingSaveRef.current = save;
    const timer = setTimeout(save, CLOUD_SYNC_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [shareId, deleteToken, roomLayout, linkFingerprint, recordSave, enqueueUpload]);

  // When the owner leaves the room (a layout switch, or the link becomes
  // view-only), this saves a change that is still in its debounce, after any
  // upload in flight. That save lands after the room is gone and records
  // nothing in it. The room still
  // counts the change as unsaved, so it keeps the change over a joiner's copy
  // until the owner's next visit records it.
  useEffect(() => {
    return () => {
      pendingSaveRef.current?.();
    };
  }, []);
}
