/**
 * Every synced item kind, read from the PUT handlers themselves: the payload
 * key, the newest envelope version, and the `buildPut` that validated and
 * measured the stored payload. Re-running that `buildPut` on a stored payload
 * checks it exactly as production would accept it today.
 */

import type { BuildPutResult, SyncEnvelope } from '../../../api/sync/lib/resourceHandler.js';
import * as layouts from '../../../api/sync/layouts/[id].js';
import * as designs from '../../../api/sync/designs/[id].js';
import * as baseplates from '../../../api/sync/baseplates/[id].js';
import * as designVersions from '../../../api/sync/designVersions/[id].js';
import * as folders from '../../../api/sync/folders/[id].js';
import * as cutoutItems from '../../../api/sync/cutoutItems/[id].js';
import * as cutoutFolders from '../../../api/sync/cutoutFolders/[id].js';
import type { Kind } from './types.js';

export interface KindSpec {
  readonly payloadKey: string;
  /** The version the handler writes now; older envelopes carry a lower one. */
  readonly schemaVersion: number;
  readonly buildPut: (
    payload: unknown,
    modifiedAt: number,
    id: string,
    body: Record<string, unknown>
  ) => BuildPutResult<SyncEnvelope>;
}

const spec = (handler: {
  resource: Pick<KindSpec, 'payloadKey' | 'buildPut'>;
  SCHEMA_VERSION: number;
}): KindSpec => ({
  payloadKey: handler.resource.payloadKey,
  schemaVersion: handler.SCHEMA_VERSION,
  buildPut: handler.resource.buildPut,
});

export const KIND_SPECS: Readonly<Record<Kind, KindSpec>> = {
  layouts: spec(layouts),
  designs: spec(designs),
  baseplates: spec(baseplates),
  designVersions: spec(designVersions),
  folders: spec(folders),
  cutoutItems: spec(cutoutItems),
  cutoutFolders: spec(cutoutFolders),
};

export const ALL_KINDS = Object.keys(KIND_SPECS) as readonly Kind[];

export function isKind(value: string | undefined): value is Kind {
  return value !== undefined && Object.hasOwn(KIND_SPECS, value);
}

/** A version some handler of this kind wrote: 1 up to the current one. */
export function isSchemaVersionOf(kind: Kind, version: unknown): boolean {
  return (
    typeof version === 'number' &&
    Number.isInteger(version) &&
    version >= 1 &&
    version <= KIND_SPECS[kind].schemaVersion
  );
}
