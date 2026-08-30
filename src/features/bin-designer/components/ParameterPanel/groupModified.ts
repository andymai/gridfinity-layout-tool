/**
 * Which single-scroll panel groups hold something changed from the defaults.
 *
 * Drives the dot on a StickyGroupHeader, so a collapsed group still says where
 * the edits are. The sibling `modifiedCategories` answers the same question for
 * the rail's task categories; this one is keyed to the scroll panel's
 * anatomical groups (shape/lid/interior/base/finishing), which read down the
 * part the way the object is built.
 */

import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';

import { paramFieldModified } from './paramFieldModified';

export type PanelGroup = 'shape' | 'lid' | 'interior' | 'base' | 'finishing';

/**
 * Where a param is edited. Anything unlisted belongs to Shape, which is what
 * makes this safe to leave alone: a field added later lands on a real group
 * rather than being silently dropped from the comparison, and a dot in the
 * wrong place is visible where a missing one is not. Shape owns the size, walls,
 * custom footprint, drawer fit, and split fields by that fallback.
 */
const GROUP_OF: Partial<Record<keyof BinParams, PanelGroup>> = {
  lid: 'lid',
  handles: 'lid',
  base: 'base',
  style: 'interior',
  compartments: 'interior',
  scoop: 'interior',
  label: 'interior',
  slotConfig: 'interior',
  dividerPieces: 'interior',
  inserts: 'interior',
  cutouts: 'interior',
  cutoutConfig: 'interior',
  cutoutGroupNames: 'interior',
  meshAssets: 'interior',
  knifeRest: 'interior',
  slide: 'interior',
  wallPattern: 'finishing',
  floorPattern: 'finishing',
  featureColors: 'finishing',
  gridUnitMm: 'finishing',
  gridUnitMmY: 'finishing',
  heightUnitMm: 'finishing',
  nozzleSizeMm: 'finishing',
};

/**
 * Params edited from more than one group, deliberately left out.
 *
 * `surfaceText` holds wall text (Finishing) and lid text (Lid) in one map, and
 * `textDefaults` styles text on both label tabs (Interior) and the lid.
 * Attributing either to a single group would light the wrong dot, a worse
 * failure than not lighting one, because a dot that is sometimes wrong cannot be
 * trusted anywhere.
 */
const SPANS_GROUPS: ReadonlySet<string> = new Set(['surfaceText', 'textDefaults']);

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
    if (paramFieldModified(params, key)) {
      modified[GROUP_OF[key as keyof BinParams] ?? 'shape'] = true;
    }
  }

  return modified;
}
