/**
 * Shared React contexts for cross-cutting concerns.
 */

export { MutationsContext, LocalMutationsProvider, useMutations } from './MutationsContext';
export type { Mutations } from './MutationsContext';

export { PresenceContext } from './PresenceContext';
export type { CollabPresenceActions } from './PresenceContext';
