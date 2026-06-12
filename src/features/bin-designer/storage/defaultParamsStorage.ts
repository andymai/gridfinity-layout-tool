/**
 * Persistence for the user's custom "default for new bins".
 *
 * Stores a single style-only `Partial<BinParams>` in localStorage so that
 * `newDesign()` / `resetToDefaults()` can start fresh bins from the user's
 * preferred style instead of the hardcoded factory baseline.
 *
 * Per-design geometry (compartments, cutouts, custom shape, etc.) is stripped
 * before saving — see `extractStyleDefaults` / `STYLE_DEFAULT_OMIT_KEYS`. On
 * load the partial is re-completed via `migrateParams()`, which backfills the
 * stripped keys from `DEFAULT_BIN_PARAMS`, so the stored value survives schema
 * evolution the same way saved designs do.
 *
 * Built on the canonical localStorage backend (mirrors `customBinRegistry`).
 */

import { isErr } from '@/core/result';
import type { Result, StorageError } from '@/core/result';
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  deleteFromLocalStorage,
  existsInLocalStorage,
} from '@/core/storage/backends/localStorage';
import { isPartialMask, validateMask } from '@/shared/utils/cellMask';
import type { BinParams } from '@/features/bin-designer/types';
import { extractStyleDefaults, migrateParams } from '@/features/bin-designer/constants';

/** localStorage key for the user's custom default bin params. */
const DEFAULT_PARAMS_KEY = 'gridfinity-designer-default-params-v1';

/**
 * Persist the user's current params as the default for new bins, after
 * stripping per-design geometry. Returns a Result so callers can surface a
 * storage failure (e.g. quota exceeded) to the user.
 */
export function saveDefaultParams(params: BinParams): Result<void, StorageError> {
  return saveToLocalStorage(DEFAULT_PARAMS_KEY, extractStyleDefaults(params));
}

/**
 * Load the user's custom default, re-completed into a full `BinParams`.
 *
 * Returns `null` when no custom default is stored, the stored value is
 * corrupt, or it fails to parse — callers fall back to `DEFAULT_BIN_PARAMS`.
 */
export function loadDefaultParams(): BinParams | null {
  const result = loadFromLocalStorage<Partial<BinParams>>(DEFAULT_PARAMS_KEY);
  if (isErr(result) || result.value === null) return null;

  let migrated = migrateParams(result.value);
  // Belt-and-braces (parity with `loadDesign`): `extractStyleDefaults`
  // always strips `cellMask`, but a hand-tampered localStorage value could
  // carry a structurally-invalid mask. Drop it back to the rectangle
  // fast-path rather than hand an invalid polygon to the generator.
  if (isPartialMask(migrated.cellMask) && validateMask(migrated.cellMask) !== null) {
    migrated = { ...migrated, cellMask: undefined };
  }
  return migrated;
}

/** Remove the user's custom default, reverting new bins to factory defaults. */
export function clearDefaultParams(): void {
  deleteFromLocalStorage(DEFAULT_PARAMS_KEY);
}

/** Whether a custom default is currently stored. */
export function hasCustomDefault(): boolean {
  return existsInLocalStorage(DEFAULT_PARAMS_KEY);
}
