/**
 * Typed event bus for design-linking sync events.
 *
 * Decouples event emitters (bin-designer auto-save, resize interaction)
 * from consumers (auto-sync listener hooks) to avoid circular dependencies
 * between features.
 *
 * Module-scoped singleton — subscribers are registered via React hooks
 * that clean up on unmount.
 */

import type { BinId } from '@/core/types';

// =============================================================================
// Event Types
// =============================================================================

/** Dimensions carried in sync events (width/depth in grid units, height in height units) */
interface SyncEventDimensions {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}

export interface DesignSavedEvent {
  readonly type: 'design-saved';
  readonly designId: string;
  readonly dimensions: SyncEventDimensions;
}

export interface BinResizedEvent {
  readonly type: 'bin-resized';
  readonly binId: BinId;
  readonly linkedDesignId: string;
  readonly newDimensions: SyncEventDimensions;
}

export type SyncEvent = DesignSavedEvent | BinResizedEvent;

// =============================================================================
// Event Bus
// =============================================================================

type Listener<T extends SyncEvent = SyncEvent> = (event: T) => void;

const listeners = new Map<SyncEvent['type'], Set<Listener>>();

/**
 * Subscribe to a specific sync event type.
 * Returns an unsubscribe function.
 */
export function onSyncEvent<T extends SyncEvent>(
  type: T['type'],
  listener: Listener<T>
): () => void {
  let set = listeners.get(type);
  if (!set) {
    set = new Set();
    listeners.set(type, set);
  }
  set.add(listener as Listener);

  return () => {
    set.delete(listener as Listener);
    if (set.size === 0) {
      listeners.delete(type);
    }
  };
}

/**
 * Emit a sync event to all registered listeners of that type.
 */
export function emitSyncEvent(event: SyncEvent): void {
  const set = listeners.get(event.type);
  if (!set) return;
  for (const listener of set) {
    listener(event);
  }
}
