/**
 * Pushes skipped because a mesh file was not on this device, so the server's
 * copy kept its mesh. Nothing else pushes such an item again before its next
 * edit, so the file's arrival announces it as changed.
 */

import type { AdapterChangeListener } from '@/core/sync/adapters/types';
import { subscribeMeshFileArrivals } from '@/shared/generation/meshStore';

export interface MissingMeshPushes {
  /** Note that item `id`, last changed at `modifiedAt`, waits on file `hash`. */
  skip(hash: string, id: string, modifiedAt: number): void;
  /** Announce each skipped item as changed once its file arrives. */
  subscribe(listener: AdapterChangeListener): () => void;
}

export function createMissingMeshPushes(): MissingMeshPushes {
  const waiting = new Map<string, Map<string, number>>();
  return {
    skip(hash, id, modifiedAt) {
      const items = waiting.get(hash) ?? new Map<string, number>();
      items.set(id, modifiedAt);
      waiting.set(hash, items);
    },
    subscribe(listener) {
      return subscribeMeshFileArrivals((hash) => {
        const items = waiting.get(hash);
        if (!items) return;
        waiting.delete(hash);
        for (const [id, modifiedAt] of items) listener({ kind: 'put', id, modifiedAt });
      });
    },
  };
}
