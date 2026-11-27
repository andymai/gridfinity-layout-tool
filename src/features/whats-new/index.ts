/**
 * Public surface. `entries.ts` is intentionally absent: it is ~8kB gzipped and
 * belongs to the modal's lazy chunk, so importers reach it by its own path.
 */
export { shownEntries } from './schedule';
export { useLocalDay } from './hooks/useLocalDay';
export { useWhatsNewAutoOpen } from './hooks/useWhatsNewAutoOpen';
export { useHasUnseen, hasUnseen, markAllSeen, reloadSeenState } from './seenState';
export type { WhatsNewEntry, WhatsNewKind, WhatsNewAction, LocalizedText } from './types';
