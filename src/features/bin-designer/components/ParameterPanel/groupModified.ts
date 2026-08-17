/**
 * Which panel groups hold something changed from the defaults.
 *
 * Drives the dot on a group header, so a collapsed panel still says where the
 * edits are. The summaries say WHAT a group holds; this says whether it is
 * stock, which is the question you can only otherwise answer by remembering
 * every default.
 */

import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';

export type PanelGroup = 'shape' | 'lid' | 'interior' | 'base' | 'finishing';

/**
 * Where a param is edited. Anything unlisted belongs to Shape, which is what
 * makes this safe to leave alone: a field added later lands on a real group
 * rather than being silently dropped from the comparison, and a dot in the
 * wrong place is visible where a missing one is not.
 */
const GROUP_OF: Partial<Record<keyof BinParams, PanelGroup>> = {
  lid: 'lid',
  style: 'interior',
  compartments: 'interior',
  scoop: 'interior',
  label: 'interior',
  slotConfig: 'interior',
  dividerPieces: 'interior',
  inserts: 'interior',
  cutouts: 'interior',
  cutoutConfig: 'interior',
  meshAssets: 'interior',
  base: 'base',
  floorPattern: 'base',
  featureColors: 'finishing',
  gridUnitMm: 'finishing',
  gridUnitMmY: 'finishing',
  heightUnitMm: 'finishing',
  nozzleSizeMm: 'finishing',
};

/**
 * Params edited from more than one group, deliberately left out.
 *
 * `surfaceText` holds wall text (Shape) and lid text (Lid) in one map, and
 * `textDefaults` styles both. Attributing either to a single group would light
 * the wrong dot, a worse failure than not lighting one, because a dot that is
 * sometimes wrong cannot be trusted anywhere.
 */
const SPANS_GROUPS: ReadonlySet<string> = new Set(['surfaceText', 'textDefaults']);

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
  return JSON.stringify(canonical(current[key])) === JSON.stringify(canonical(defaults[key]));
}

export function modifiedGroups(params: BinParams): Record<PanelGroup, boolean> {
  const modified: Record<PanelGroup, boolean> = {
    shape: false,
    lid: false,
    interior: false,
    base: false,
    finishing: false,
  };

  // Both sides, so an optional field the defaults omit (`cellMask`) still
  // counts once a design carries it.
  const keys = new Set([...Object.keys(DEFAULT_BIN_PARAMS), ...Object.keys(params)]);

  for (const key of keys) {
    if (SPANS_GROUPS.has(key)) continue;
    if (matchesDefault(params, key)) continue;
    modified[GROUP_OF[key as keyof BinParams] ?? 'shape'] = true;
  }

  return modified;
}
