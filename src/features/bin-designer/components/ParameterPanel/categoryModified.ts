/**
 * Which rail categories hold something changed from the defaults.
 *
 * Drives the dot on a category's rail icon, so the panel says where the edits
 * are without opening every page. The summaries say WHAT a category holds;
 * this says whether it is stock, which is the question you can only otherwise
 * answer by remembering every default.
 */

import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';

import type { DesignerCategory } from '@/features/bin-designer/types';

export type PageCategory = Exclude<DesignerCategory, 'selection'>;

/**
 * Where a param is edited. Anything unlisted belongs to Shape, which is what
 * makes this safe to leave alone: a field added later lands on a real group
 * rather than being silently dropped from the comparison, and a dot in the
 * wrong place is visible where a missing one is not.
 */
const CATEGORY_OF: Partial<Record<keyof BinParams, PageCategory>> = {
  style: 'interior',
  compartments: 'interior',
  scoop: 'interior',
  label: 'interior',
  slotConfig: 'interior',
  dividerPieces: 'interior',
  inserts: 'interior',
  cutouts: 'interior',
  cutoutConfig: 'interior',
  knifeRest: 'interior',
  meshAssets: 'interior',
  lid: 'features',
  walls: 'features',
  handles: 'features',
  slide: 'features',
  wallPattern: 'style',
  floorPattern: 'style',
  featureColors: 'style',
  surfaceText: 'style',
  textDefaults: 'style',
  gridUnitMm: 'print',
  gridUnitMmY: 'print',
  heightUnitMm: 'print',
  nozzleSizeMm: 'print',
  splitConnectors: 'print',
};

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

function matchesDefault(params: BinParams, key: string): boolean {
  const defaults = DEFAULT_BIN_PARAMS as unknown as Record<string, unknown>;
  const current = params as unknown as Record<string, unknown>;

  // A design that omits a key runs on the default, so absent IS unmodified.
  // Legacy persisted designs omit `featureColors` and `floorPattern` (both have
  // runtime fallbacks at every read site), and comparing an absent key against
  // a populated default marked their group changed over a field the owner never
  // touched. A dot that is sometimes wrong cannot be trusted anywhere, which is
  // the same reason the cross-group keys below are excluded outright.
  if (current[key] === undefined) return true;

  // Identity before structure. Params start as a shallow copy of the defaults
  // and the store updates them immutably with structural sharing, so a field
  // nobody has touched is still the DEFAULT object itself, and an edit changes
  // the identity of only the branch it touched. Without this the serialisation
  // below ran over every field on every params change, including `meshAssets`,
  // whose entries each hold a base64-deflated mesh.
  if (current[key] === defaults[key]) return true;

  return JSON.stringify(canonical(current[key])) === JSON.stringify(canonical(defaults[key]));
}

export function modifiedCategories(params: BinParams): Record<PageCategory, boolean> {
  const modified: Record<PageCategory, boolean> = {
    shape: false,
    interior: false,
    features: false,
    style: false,
    print: false,
  };

  // Both sides, so an optional field the defaults omit (`cellMask`) still
  // counts once a design carries it.
  const keys = new Set([...Object.keys(DEFAULT_BIN_PARAMS), ...Object.keys(params)]);

  // The task-based taxonomy resolves what the anatomy one could not:
  // `surfaceText` and `textDefaults` are text appearance wherever the letters
  // sit, so both attribute cleanly to Style instead of being excluded.
  for (const key of keys) {
    if (matchesDefault(params, key)) continue;
    modified[CATEGORY_OF[key as keyof BinParams] ?? 'shape'] = true;
  }

  return modified;
}
