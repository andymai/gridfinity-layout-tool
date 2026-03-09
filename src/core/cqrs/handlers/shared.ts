/**
 * Shared utilities for command handlers.
 */

import type { LayoutId } from '@/core/types';
import { useLibraryStore } from '@/core/store/library';
import { eventId } from '../types';
import type { CommandMeta, EventMeta } from '../types';

/** Monotonic version counter per aggregate (resets on page load — fine for client-side) */
const versionCounters = new Map<string, number>();

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
  const id: string = aggregateId;
  return {
    id: eventId(`evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    timestamp: Date.now(),
    correlationId: commandMeta.correlationId,
    commandId: commandMeta.id,
    aggregateId,
    version: nextVersion(id),
  };
}

/** Reset version counters (for testing) */
export function resetVersionCounters(): void {
  versionCounters.clear();
}
