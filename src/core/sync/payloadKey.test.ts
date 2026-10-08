/**
 * Cross-boundary equality tests: `api/` cannot import from `src/`, so
 * `PAYLOAD_KEY` here and the `PAYLOAD_KEY` each `api/sync/{kind}/[id].ts`
 * exports only stay in lockstep via these tests.
 */
import { describe, expect, it } from 'vitest';
import {
  LAYOUT_SCHEMA_VERSION,
  MISSING_DEPENDENCY_STATUS,
  PAYLOAD_KEY,
  syncPutBody,
} from './payloadKey';
import type { SyncKind } from './adapters/types';

import {
  PAYLOAD_KEY as API_LAYOUTS_PAYLOAD_KEY,
  SCHEMA_VERSION as API_LAYOUTS_SCHEMA_VERSION,
} from '../../../api/sync/layouts/[id].js';
import { PAYLOAD_KEY as API_DESIGNS_PAYLOAD_KEY } from '../../../api/sync/designs/[id].js';
import { PAYLOAD_KEY as API_BASEPLATES_PAYLOAD_KEY } from '../../../api/sync/baseplates/[id].js';
import { PAYLOAD_KEY as API_DESIGN_VERSIONS_PAYLOAD_KEY } from '../../../api/sync/designVersions/[id].js';
import { PAYLOAD_KEY as API_FOLDERS_PAYLOAD_KEY } from '../../../api/sync/folders/[id].js';
import { MESH_MISSING_STATUS } from '../../../api/sync/lib/resourceHandler.js';

const ALL_SYNC_KINDS: readonly SyncKind[] = [
  'layouts',
  'designs',
  'baseplates',
  'designVersions',
  'folders',
];

const API_PAYLOAD_KEY: Record<SyncKind, string> = {
  layouts: API_LAYOUTS_PAYLOAD_KEY,
  designs: API_DESIGNS_PAYLOAD_KEY,
  baseplates: API_BASEPLATES_PAYLOAD_KEY,
  designVersions: API_DESIGN_VERSIONS_PAYLOAD_KEY,
  folders: API_FOLDERS_PAYLOAD_KEY,
};

describe('PAYLOAD_KEY', () => {
  it('has exactly the five known sync kinds as keys, no more, no less', () => {
    const keys = Object.keys(PAYLOAD_KEY);
    expect(keys).toHaveLength(ALL_SYNC_KINDS.length);
    for (const kind of ALL_SYNC_KINDS) {
      expect(keys).toContain(kind);
    }
  });

  it.each(ALL_SYNC_KINDS)("matches the %s endpoint's exported PAYLOAD_KEY", (kind) => {
    expect(PAYLOAD_KEY[kind]).toBe(API_PAYLOAD_KEY[kind]);
  });

  it('assigns a distinct payload key per kind (no fallback collisions)', () => {
    const values = Object.values(PAYLOAD_KEY);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('syncPutBody', () => {
  it('declares the layout schema the server stamps', () => {
    expect(LAYOUT_SCHEMA_VERSION).toBe(API_LAYOUTS_SCHEMA_VERSION);
  });

  it('declares the layout payload schema', () => {
    expect(syncPutBody('layouts', { v: 1 }, 1000)).toEqual({
      layout: { v: 1 },
      modifiedAt: 1000,
      schemaVersion: LAYOUT_SCHEMA_VERSION,
    });
  });

  it('leaves other kinds as they were', () => {
    expect(syncPutBody('designs', { v: 1 }, 1000)).toEqual({ design: { v: 1 }, modifiedAt: 1000 });
  });
});

describe('MISSING_DEPENDENCY_STATUS', () => {
  it('is the status the server refuses a write naming a mesh file it lacks with', () => {
    expect(MISSING_DEPENDENCY_STATUS).toBe(MESH_MISSING_STATUS);
  });
});
