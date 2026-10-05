import type { SyncKind } from './adapters/types';

/** Mirrors `SCHEMA_VERSION` in api/sync/layouts/[id].ts; declared on every layout PUT. */
export const LAYOUT_SCHEMA_VERSION = 2;

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
export const PAYLOAD_KEY: Record<
  SyncKind,
  'layout' | 'design' | 'baseplate' | 'designVersion' | 'folder'
> = {
  layouts: 'layout',
  designs: 'design',
  baseplates: 'baseplate',
  designVersions: 'designVersion',
  folders: 'folder',
};

export function syncPutBody(
  kind: SyncKind,
  payload: unknown,
  modifiedAt: number
): Record<string, unknown> {
  return {
    [PAYLOAD_KEY[kind]]: payload,
    modifiedAt,
    ...(kind === 'layouts' ? { schemaVersion: LAYOUT_SCHEMA_VERSION } : {}),
  };
}
