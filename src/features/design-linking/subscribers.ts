/**
 * CQRS Event Subscribers for Design-Linking
 *
 * Bridges CQRS domain events to the existing syncEventBus that the React
 * listener hooks (useDesignSavedListener, useBinResizedListener) consume.
 *
 * This is the incremental migration path: CQRS events → syncEventBus → React hooks.
 * In the future, the hooks can be refactored to subscribe to CQRS events directly.
 *
 * **Future behavioral change (when fully wired):**
 * - CQRS subscribers will be always-active (registered at app bootstrap), unlike React hooks
 *   that only run when their host component is mounted.
 * - `bin.updated` events from ALL sources (including undo/redo) will trigger cascades.
 *   The `source: 'cascade'` CommandSource (added in this PR) will prevent infinite loops.
 */

import type { EventBus, UnsubscribeFn } from '@/core/cqrs';

/**
 * Connect design-linking CQRS subscribers to the event bus.
 * Returns an unsubscribe function.
 *
 * Currently a no-op bridge — the actual event flow still uses syncEventBus
 * directly from useAutoSave and useBinInspector. This subscriber will be
 * activated when those callers are migrated to dispatch CQRS commands.
 */
export function connectDesignLinking(bus: EventBus): UnsubscribeFn {
  const unsubscribers: UnsubscribeFn[] = [];

  // Listen for designer.saved events — these will eventually replace
  // the direct emitSyncEvent('design-saved', ...) call in useAutoSave
  unsubscribers.push(
    bus.subscribe('designer.saved', (_event) => {
      // Future: look up design dimensions from registry and emit sync event
      // For now, the sync event is still emitted directly by useAutoSave
    })
  );

  // Listen for bin.updated events with dimension changes — these will
  // eventually replace the direct emitSyncEvent('bin-resized', ...) call
  // in useBinInspector
  unsubscribers.push(
    bus.subscribe('bin.updated', (event) => {
      const { changes } = event.payload;
      // Only react to dimension changes
      if (!('width' in changes) && !('depth' in changes) && !('height' in changes)) return;

      // Future: emit sync event for sibling cascade
      // For now, the sync event is still emitted directly by useBinInspector
    })
  );

  return () => {
    for (const unsub of unsubscribers) {
      unsub();
    }
  };
}
