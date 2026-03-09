/**
 * Shared utilities for command handlers.
 */

import type { LayoutId } from '@/core/types';
import { useLibraryStore } from '@/core/store/library';
import { eventId } from '../types';
import type { CommandMeta, EventMeta } from '../types';

/** Monotonic version counter per aggregate (resets on page load — fine for client-side) */
const versionCounters = new Map<string, number>();

/** Monotonic event ID counter — prevents collisions in sub-millisecond batch operations */
let eventCounter = 0;

function nextVersion(aggregateId: string): number {
  const current = versionCounters.get(aggregateId) ?? 0;
  const next = current + 1;
  versionCounters.set(aggregateId, next);
  return next;
}

/**
 * Create event metadata from command metadata.
 * Derives aggregateId from the active layout.
 */
export function createEventMeta(commandMeta: CommandMeta): EventMeta {
  const aggregateId: LayoutId = useLibraryStore.getState().library.activeLayoutId;
  return {
    id: eventId(`evt_${Date.now()}_${++eventCounter}`),
    timestamp: Date.now(),
    correlationId: commandMeta.correlationId,
    commandId: commandMeta.id,
    aggregateId,
    version: nextVersion(aggregateId),
  };
}

/**
 * Capture previous values from an entity for the fields being updated.
 * Used by update handlers to record what changed.
 */
export function capturePrevious<T extends object>(existing: T, updates: Partial<T>): Partial<T> {
  const previous: Partial<T> = {};
  for (const key of Object.keys(updates) as Array<keyof T>) {
    (previous as Record<string, unknown>)[key as string] = existing[key];
  }
  return previous;
}

/** Reset version and event counters (for testing) */
export function resetVersionCounters(): void {
  versionCounters.clear();
  eventCounter = 0;
}
