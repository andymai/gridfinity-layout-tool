/**
 * Library Persistence Event Subscriber
 *
 * Persists the library to IndexedDB immediately when cloudShare metadata
 * changes. Other library mutations (createEntry, deleteEntry, updateEntry,
 * etc.) are persisted indirectly via {@link useAutoSave}, which atomically
 * saves layout + library together with a 1s debounce.
 *
 * cloudShare needs immediate persistence because it's library-only metadata
 * that wouldn't trigger useAutoSave (which keys off layout changes).
 */

import type { UnsubscribeFn } from '../types';
import type { EventBus } from '../bus/eventBus';
import { useLibraryStore } from '@/core/store/library';
import { saveLibrary } from '@/core/storage';
import { isErr } from '@/core/result';

function persistLibrary(): void {
  const snapshot = structuredClone(useLibraryStore.getState().library);
  void saveLibrary(snapshot).then((result) => {
    if (isErr(result)) {
      console.warn('[library] Background save failed:', result.error.code, result.error.message);
    }
  });
}

/**
 * Connect library persistence subscriber to the event bus.
 * Returns an unsubscribe function that removes all subscribers.
 */
export function connectLibraryPersistence(bus: EventBus): UnsubscribeFn {
  const unsubscribers: UnsubscribeFn[] = [];

  unsubscribers.push(bus.subscribe('library.cloudShareUpdated', () => persistLibrary()));
  unsubscribers.push(bus.subscribe('library.cloudShareCleared', () => persistLibrary()));

  return () => {
    for (const unsub of unsubscribers) {
      unsub();
    }
  };
}
