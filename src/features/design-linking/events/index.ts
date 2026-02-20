/**
 * Sync event bus - re-exported from @/shared/events for convenience.
 */

export { emitSyncEvent, onSyncEvent } from '@/shared/events/syncEventBus';
export type { SyncEvent, DesignSavedEvent, BinResizedEvent } from '@/shared/events/syncEventBus';
