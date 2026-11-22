/**
 * A library item as a `.json` file, to keep or to hand to someone else.
 *
 * The file holds its meshes inline, so it opens on a device that never saw
 * them. Import checks the content the way a design import does: wrapped in a
 * bin, migrated, then validated, so one set of rules reads both files.
 */

import type { BinParams, CutoutShape } from '@/features/bin-designer/types';
import { MIN_PATH_POINTS } from '@/features/bin-designer/types';
import { MAX_MESH_TRIANGLES_PER_DESIGN, meshTrianglesTotal } from '@/shared/generation/meshAsset';
import type { TFunction } from '@/i18n';
import type { Result, StorageMeshMissingError, StorageNotSavedError } from '@/core/result';
import { err, isErr, OK, storageNotSaved } from '@/core/result';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { migrateParams } from '@/features/bin-designer/constants/paramMigration';
import { validateImportedBinParams } from '@/features/bin-designer/utils/designJson';
import { sanitizeFileName } from '@/features/bin-designer/utils/fileNaming';
import { inlineHolderMeshes } from '@/shared/generation/meshRefs';
import { deliverExport } from '@/shared/exportDestination/deliverExport';
import { primeExportFolder } from '@/shared/exportDestination/exportFolder';
import {
  MAX_LIBRARY_NAME_LENGTH,
  type CutoutLibraryContent,
  type CutoutLibraryItem,
  type LibraryParams,
} from './libraryTypes';

export const LIBRARY_FILE_TYPE = 'gridfinity-cutout-library-item';
const LIBRARY_FILE_VERSION = '1.0';

interface LibraryFile {
  readonly type: typeof LIBRARY_FILE_TYPE;
  readonly version: string;
  readonly name: string;
  readonly params: LibraryParams;
  readonly _meta: { readonly exportedFrom: string; readonly exportedAt: string };
}

export function exportLibraryItemJSON(name: string, content: CutoutLibraryContent): string {
  const file: LibraryFile = {
    type: LIBRARY_FILE_TYPE,
    version: LIBRARY_FILE_VERSION,
    name,
    params: content.params,
    _meta: {
      exportedFrom: 'https://gridfinitylayouttool.com',
      exportedAt: new Date().toISOString(),
    },
  };
  return JSON.stringify(file, null, 2);
}

/** Save the item as a file. Fails, saving nothing, when one of its meshes is not on this device. */
export async function downloadLibraryItem(
  item: CutoutLibraryItem
): Promise<Result<void, StorageMeshMissingError | StorageNotSavedError>> {
  primeExportFolder();
  const inline = await inlineHolderMeshes(item.content);
  if (isErr(inline)) return inline;
  const sanitized = sanitizeFileName(item.name);
  const base = !sanitized || /^_+$/.test(sanitized) ? 'cutout' : sanitized;
  const saved = await deliverExport(
    new Blob([exportLibraryItemJSON(item.name, inline.value)], { type: 'application/json' }),
    `${base}.cutouts.json`
  );
  return saved ? OK : err(storageNotSaved());
}

export interface ParsedLibraryFile {
  readonly name: string;
  readonly content: CutoutLibraryContent;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const SHAPES: Record<CutoutShape, true> = {
  rectangle: true,
  circle: true,
  path: true,
  polygon: true,
  slot: true,
  mesh: true,
  knifeSlot: true,
  text: true,
};

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Whether a hand-written cutout has the geometry the editor reads. The design
 * check reads the bin around the cutouts, not each cutout, and a cutout with
 * no size would reach the bounds and the render as NaN.
 */
function isPlaceableCutout(c: unknown, meshAssets: unknown): boolean {
  if (!isObject(c) || typeof c.shape !== 'string' || !(c.shape in SHAPES)) return false;
  if (![c.x, c.y, c.width, c.depth, c.cutDepth].every(finite)) return false;
  if ((c.width as number) <= 0 || (c.depth as number) <= 0) return false;
  if (c.shape === 'path') {
    const path = c.path;
    if (!Array.isArray(path) || path.length < MIN_PATH_POINTS) return false;
    if (!path.every((pt) => isObject(pt) && finite(pt.x) && finite(pt.y))) return false;
  }
  if (c.shape === 'mesh') {
    return typeof c.meshId === 'string' && isObject(meshAssets) && isObject(meshAssets[c.meshId]);
  }
  return true;
}

/** The item in `json`, or null when it is not a library file with at least one valid cutout. */
export function parseLibraryItemJSON(json: string, t: TFunction): ParsedLibraryFile | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObject(data) || data.type !== LIBRARY_FILE_TYPE || !isObject(data.params)) return null;
  const { cutouts, cutoutGroupNames, meshAssets } = data.params;
  if (!Array.isArray(cutouts) || cutouts.length === 0) return null;
  if (!cutouts.every((c) => isPlaceableCutout(c, meshAssets))) return null;
  const wrapped: Record<string, unknown> = {
    ...DEFAULT_BIN_PARAMS,
    style: 'solid',
    cutouts,
    ...(cutoutGroupNames === undefined ? {} : { cutoutGroupNames }),
    ...(meshAssets === undefined ? {} : { meshAssets }),
  };
  if (!validateImportedBinParams(wrapped, t).valid) return null;
  let migrated: BinParams;
  try {
    migrated = migrateParams(wrapped);
  } catch {
    // A hand-written cutout can still be the wrong shape inside.
    return null;
  }
  if (migrated.cutouts.length === 0) return null;
  if (
    migrated.meshAssets &&
    meshTrianglesTotal(migrated.meshAssets) > MAX_MESH_TRIANGLES_PER_DESIGN
  ) {
    return null;
  }
  const name =
    typeof data.name === 'string' ? data.name.trim().slice(0, MAX_LIBRARY_NAME_LENGTH) : '';
  return {
    name,
    content: {
      params: {
        cutouts: migrated.cutouts.map(({ locked: _locked, libraryItemId: _id, ...c }) => c),
        ...(migrated.cutoutGroupNames ? { cutoutGroupNames: migrated.cutoutGroupNames } : {}),
        ...(migrated.meshAssets ? { meshAssets: migrated.meshAssets } : {}),
      },
    },
  };
}
