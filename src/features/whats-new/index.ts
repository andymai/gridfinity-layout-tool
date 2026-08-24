/**
 * Public surface. `entries.ts` is intentionally absent: it is ~8kB gzipped and
 * belongs to the modal's lazy chunk, so importers reach it by its own path.
 */
export { LATEST_ENTRY_ID } from './latest';
export { useWhatsNewAutoOpen } from './useWhatsNewAutoOpen';
export { useSeenState, hasUnseen, markAllSeen, reloadSeenState } from './seenState';
export type { WhatsNewEntry, WhatsNewKind, WhatsNewAction, LocalizedText } from './types';
