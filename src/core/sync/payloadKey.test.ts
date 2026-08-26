/**
 * These mirror the `payloadKey` field each `api/sync/{kind}/[id].ts` passes
 * to `createSyncResourceHandler` — the two sides only stay in lockstep via
 * this cross-boundary check, since `api/` cannot import from `src/`.
 */
import { describe, expect, it } from 'vitest';
import { PAYLOAD_KEY } from './payloadKey';
import type { SyncKind } from './adapters/types';

const ALL_SYNC_KINDS: readonly SyncKind[] = ['layouts', 'designs', 'baseplates', 'designVersions'];

const SERVER_PAYLOAD_KEY: Record<SyncKind, string> = {
  layouts: 'layout',
  designs: 'design',
  baseplates: 'baseplate',
  designVersions: 'designVersion',
};

describe('PAYLOAD_KEY', () => {
  it('has exactly the four known sync kinds as keys, no more, no less', () => {
    const keys = Object.keys(PAYLOAD_KEY);
    expect(keys).toHaveLength(ALL_SYNC_KINDS.length);
    for (const kind of ALL_SYNC_KINDS) {
      expect(keys).toContain(kind);
    }
  });

  it.each(ALL_SYNC_KINDS.map((kind) => [kind, SERVER_PAYLOAD_KEY[kind]] as const))(
    'maps %s to the %s payload key the server expects',
    (kind, expected) => {
      expect(PAYLOAD_KEY[kind]).toBe(expected);
    }
  );

  it('assigns a distinct payload key per kind (no fallback collisions)', () => {
    const values = Object.values(PAYLOAD_KEY);
    expect(new Set(values).size).toBe(values.length);
  });
});
