import type { SyncKind } from './adapters/types';

/**
 * The key each kind's payload travels under, in both directions: the `PUT` body
 * a client sends and the envelope field the server returns.
 *
 * Its own module because four call sites need it (the engine's push, the
 * beacon flush, the poller's pull, and the claim merge) and only one of them
 * owns the engine. Every one of those previously derived the key from a chain
 * of ternaries whose fallback arm was `design`, so a kind added after
 * `baseplates` was silently sent and read under the wrong name.
 */
export const PAYLOAD_KEY: Record<SyncKind, 'layout' | 'design' | 'baseplate' | 'designVersion'> = {
  layouts: 'layout',
  designs: 'design',
  baseplates: 'baseplate',
  designVersions: 'designVersion',
};
