/**
 * Whether a single top-level param field differs from its stock default.
 *
 * Shared by `groupModified` and `categoryModified`, which route the same
 * yes/no through two different taxonomies (anatomical groups vs. task
 * categories) and decide separately what to do with keys that span more than
 * one bucket.
 */

import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';

/**
 * Order-insensitive structural compare.
 *
 * Keys are sorted before serialising because params are rebuilt by spreading,
 * which does not preserve insertion order. Serialising also drops
 * undefined-valued keys, so an explicitly-undefined field compares equal to an
 * absent one, the same "absent is the default" convention the community
 * fingerprint relies on.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonical(record[key])])
    );
  }
  return value;
}

export function paramFieldModified(params: BinParams, key: string): boolean {
  const defaults = DEFAULT_BIN_PARAMS as unknown as Record<string, unknown>;
  const current = params as unknown as Record<string, unknown>;

  // A design that omits a key runs on the default, so absent is NOT modified.
  // Legacy persisted designs omit `featureColors` and `floorPattern` (both have
  // runtime fallbacks at every read site), and comparing an absent key against
  // a populated default would call a field the owner never touched "modified".
  if (current[key] === undefined) return false;

  // Identity before structure. Params start as a shallow copy of the defaults
  // and the store updates them immutably with structural sharing, so a field
  // nobody has touched is still the DEFAULT object itself, and an edit changes
  // the identity of only the branch it touched. Without this the serialisation
  // below ran over every field on every params change, including `meshAssets`,
  // whose entries each hold a base64-deflated mesh.
  if (current[key] === defaults[key]) return false;

  return JSON.stringify(canonical(current[key])) !== JSON.stringify(canonical(defaults[key]));
}
