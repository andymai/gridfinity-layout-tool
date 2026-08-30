/**
 * Which rail categories hold something changed from the defaults.
 *
 * Drives the dot on a category's rail icon, so the panel says where the edits
 * are without opening every page. The summaries say WHAT a category holds;
 * this says whether it is stock, which is the question you can only otherwise
 * answer by remembering every default.
 */

import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, DesignerCategory } from '@/features/bin-designer/types';

import { paramFieldModified } from './paramFieldModified';

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
    if (paramFieldModified(params, key)) {
      modified[CATEGORY_OF[key as keyof BinParams] ?? 'shape'] = true;
    }
  }

  return modified;
}
