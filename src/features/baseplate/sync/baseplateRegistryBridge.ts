/**
 * Bridges baseplate storage events into the localStorage registry.
 *
 * The sync adapter's `applyRemote` / `applyRemoteDelete` write designs straight
 * to IndexedDB via BaseplateStorage, bypassing the registry that the selector
 * reads. Without this bridge, cloud-synced designs never appear (or disappear)
 * in the active-baseplate list. Local mutations already upsert the registry
 * themselves, so the bridge no-ops when the entry is already current.
 */

import { isOk } from '@/core/result';
import { loadDesign } from '@/features/baseplate/storage/BaseplateStorage';
import {
  loadRegistry,
  upsertRegistryEntry,
  removeRegistryEntry,
} from '@/features/baseplate/store/baseplateRegistry';
import { subscribe as subscribeBaseplateEvents } from './baseplateEvents';

export function startBaseplateRegistryBridge(): () => void {
  return subscribeBaseplateEvents((event) => {
    if (event.type === 'delete') {
      // Only write when the entry actually exists, so a local delete (which
      // already removed it) doesn't trigger a redundant notify.
      if (loadRegistry().some((ref) => ref.id === event.id)) {
        removeRegistryEntry(event.id);
      }
      return;
    }

    // `put`: load the full design for its current name, then upsert unless the
    // registry already matches (guards the feedback loop from local saves).
    void loadDesign(event.id).then((result) => {
      if (!isOk(result)) return;
      const design = result.value;
      const existing = loadRegistry().find((ref) => ref.id === design.id);
      if (existing && existing.name === design.name && existing.updatedAt === design.updatedAt) {
        return;
      }
      upsertRegistryEntry({ id: design.id, name: design.name, updatedAt: design.updatedAt });
    });
  });
}
