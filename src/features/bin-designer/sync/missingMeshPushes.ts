/**
 * Pushes skipped because a mesh file was not on this device, so the server's
 * copy kept its mesh. Nothing else pushes such an item again before its next
 * edit, so the file's arrival announces it as changed.
 */

import type { AdapterChangeListener } from '@/core/sync/adapters/types';
import { hasMeshFile, subscribeMeshFileArrivals } from '@/shared/generation/meshStore';

export interface MissingMeshPushes {
  /** Note that item `id`'s push waits on file `hash`. */
  skip(hash: string, id: string): void;
  /** Forget item `id`: a later change to it queues its own push or delete. */
  clear(id: string): void;
  /**
   * Announce each waiting item as changed once its file arrives, at the edit
   * time `modifiedAtOf` reads now (the outbox clears an entry only when that
   * matches what was pushed), and not at all once the item is gone.
   */
  subscribe(
    listener: AdapterChangeListener,
    modifiedAtOf: (id: string) => Promise<number | null>
  ): () => void;
}

export function createMissingMeshPushes(): MissingMeshPushes {
  const waiting = new Map<string, string>();
  let onArrival: ((hash: string) => void) | null = null;
  // A file can land after the push found it missing but before its wait was
  // noted, or while nothing listens, so presence is checked as well as heard.
  const ifPresent = (hash: string): void => {
    void hasMeshFile(hash).then((present) => {
      if (present) onArrival?.(hash);
    });
  };
  return {
    skip(hash, id) {
      waiting.set(id, hash);
      ifPresent(hash);
    },
    clear(id) {
      waiting.delete(id);
    },
    subscribe(listener, modifiedAtOf) {
      const announce = (hash: string): void => {
        for (const [id, waitedOn] of waiting) {
          if (waitedOn !== hash) continue;
          void modifiedAtOf(id)
            .then((modifiedAt) => {
              // Cleared while the read ran (that change queued its own entry),
              // or already announced by the other of arrival and presence.
              if (waiting.get(id) !== hash) return;
              waiting.delete(id);
              if (modifiedAt !== null) listener({ kind: 'put', id, modifiedAt });
            })
            .catch(() => undefined);
        }
      };
      onArrival = announce;
      const stopHearing = subscribeMeshFileArrivals(announce);
      for (const hash of new Set(waiting.values())) ifPresent(hash);
      return () => {
        stopHearing();
        if (onArrival === announce) onArrival = null;
      };
    },
  };
}
