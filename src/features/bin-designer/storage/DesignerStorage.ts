/**
 * IndexedDB storage for the Bin Designer feature.
 *
 * Uses a separate database ('gridfinity-designer-v1') to avoid
 * conflicts with the layout storage. Stores saved designs with
 * parameters, thumbnails, and timestamps.
 */

import type { DesignId } from '@/core/types';
import { designId } from '@/core/types';
import type { Result, StorageError } from '@/core/result';
import {
  ok,
  err,
  isErr,
  storageNotFound,
  storageUnavailable,
  storageCorrupted,
} from '@/core/result';
import type { SavedDesign, BinParams, ExportFileNameConfig } from '@/features/bin-designer/types';
import { THUMBNAIL_VERSION } from '@/features/bin-designer/types';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { migrateParams } from '@/features/bin-designer/constants/paramMigration';
import { DEFAULT_EXPORT_FILE_NAME_CONFIG } from '@/features/bin-designer/utils/fileNaming';
import { emit as emitDesignerEvent } from '@/features/bin-designer/sync/designerEvents';
import { normalizeTags } from '@/features/bin-designer/utils/tags';
import { trackDesignCreated } from '@/shared/analytics/posthog';
import { getDb, DESIGNS_STORE } from './designerDb';
import {
  deleteVersionsForDesign,
  listDesignVersions,
  readDesignVersion,
} from './DesignVersionService';

// Re-exported so callers that treat this module as the designer's storage
// surface keep one import site as the schema moves to `designerDb`.
export { closeDesignerDb } from './designerDb';

/** localStorage key for tracking the active design ID across sessions */
const ACTIVE_DESIGN_KEY = 'gridfinity-designer-active-v1';

/**
 * Generate a unique design ID.
 */
function generateDesignId(): DesignId {
  return designId(`design_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
}

/**
 * Save a design to IndexedDB.
 */
export async function saveDesign(
  design: Omit<SavedDesign, 'id' | 'createdAt' | 'updatedAt'> & { id?: DesignId }
): Promise<Result<SavedDesign, StorageError>> {
  try {
    const db = await getDb();
    const now = new Date().toISOString();

    // Only check for existing record when updating (id provided): preserves
    // createdAt and lets an omitted `tags` fall back to the stored tags rather
    // than silently clearing them.
    let createdAt = now;
    let existing: SavedDesign | undefined;
    if (design.id) {
      existing = (await db.get(DESIGNS_STORE, design.id)) as SavedDesign | undefined;
      if (existing) {
        createdAt = existing.createdAt;
      }
    }

    const tags = normalizeTags(design.tags ?? existing?.tags);

    // Unlike tags, `null` is meaningful here ("explicitly unpublished" / "no
    // lineage"); only an omitted field falls back to the stored value.
    const publishedId =
      design.publishedId === undefined ? existing?.publishedId : design.publishedId;
    const lineage = design.lineage === undefined ? existing?.lineage : design.lineage;

    // Branch lineage is written once, at creation, and every later save omits
    // it. Falling back to the stored value is what keeps autosave from
    // detaching a branch from its parent on the first edit.
    const parentDesignId = design.parentDesignId ?? existing?.parentDesignId;
    const parentVersionId = design.parentVersionId ?? existing?.parentVersionId;
    const parentVersionName = design.parentVersionName ?? existing?.parentVersionName;

    const kind = design.kind ?? 'bin';
    // Reject incomplete writes up front so a malformed call can't persist a
    // record that later fails loadDesign() or renders blank.
    if (kind === 'bin' && !design.params) {
      return err(storageCorrupted(design.id ?? 'new', ['bin design missing params']));
    }
    if (kind !== 'bin' && (!design.envelope || !design.structure)) {
      return err(
        storageCorrupted(design.id ?? 'new', [`${kind} design missing envelope/structure`])
      );
    }

    const savedDesign: SavedDesign = {
      id: design.id ?? generateDesignId(),
      name: design.name,
      thumbnail: design.thumbnail ?? null,
      // Set thumbnail version when saving a thumbnail
      thumbnailVersion: design.thumbnail ? THUMBNAIL_VERSION : undefined,
      exportFileNameConfig: design.exportFileNameConfig ?? null,
      createdAt,
      updatedAt: now,
      ...(tags.length > 0 ? { tags } : {}),
      ...(publishedId !== undefined ? { publishedId } : {}),
      ...(lineage !== undefined ? { lineage } : {}),
      ...(parentDesignId !== undefined ? { parentDesignId } : {}),
      ...(parentVersionId !== undefined ? { parentVersionId } : {}),
      ...(parentVersionName !== undefined ? { parentVersionName } : {}),
      // Bins persist flat `params` (canonical, back-compat); non-bin kinds
      // persist `kind` + `envelope` + `structure` and OMIT `params` so a stale
      // bin payload can never shadow the real structure.
      ...(kind === 'bin'
        ? { params: design.params }
        : { kind, envelope: design.envelope, structure: design.structure }),
    };

    await db.put(DESIGNS_STORE, savedDesign);
    // Count the design only when no record existed — `design.id` can be supplied
    // for a design that was never stored (import, restore), so presence of an id
    // is not the same question. Autosave re-enters here on every keystroke and
    // must not register as a new design.
    //
    // Imported and example-derived designs are counted: the user has a design
    // they did not have before. Worth knowing when the designer milestone
    // thresholds get re-cut against real data.
    if (!existing) {
      trackDesignCreated();
    }
    emitDesignerEvent({ type: 'put', id: savedDesign.id, updatedAt: savedDesign.updatedAt });
    return ok(savedDesign);
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}

/**
 * Load a design by ID.
 */
export async function loadDesign(id: DesignId): Promise<Result<SavedDesign, StorageError>> {
  try {
    const db = await getDb();
    const design = (await db.get(DESIGNS_STORE, id)) as SavedDesign | undefined;

    if (!design) {
      return err(storageNotFound(`Design '${id}' not found`));
    }

    // Non-bin kinds carry `envelope` + `structure` (no flat `params`).
    // Structure migration runs later in the designer store on load, so this
    // layer returns the row unchanged.
    if (design.kind && design.kind !== 'bin') {
      return ok(design);
    }

    // Validate that params is a valid object before migration
    if (!design.params || typeof design.params !== 'object' || Array.isArray(design.params)) {
      const paramsType = String(design.params) === 'null' ? 'null' : typeof design.params;
      return err(storageCorrupted(id, [`Invalid params type: ${paramsType}`]));
    }

    // Apply migration for backward compatibility with old designs
    const migratedParams = migrateParams(design.params);

    return ok({
      ...design,
      params: migratedParams,
    });
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}

/**
 * List all saved designs, sorted by most recently updated.
 */
export async function listDesigns(): Promise<Result<SavedDesign[], StorageError>> {
  try {
    const db = await getDb();
    const designs = (await db.getAll(DESIGNS_STORE)) as SavedDesign[];

    // Apply migration for backward compatibility with old designs
    // Filter out corrupted entries (invalid params) to avoid breaking the entire list
    const migratedDesigns = designs
      .filter((design) => {
        // Non-bin kinds have no flat `params` — keep them as-is.
        if (design.kind && design.kind !== 'bin') return true;
        // Skip bin entries with invalid params (null, undefined, or primitives)
        return design.params && typeof design.params === 'object' && !Array.isArray(design.params);
      })
      .map((design) =>
        design.kind && design.kind !== 'bin'
          ? design
          : { ...design, params: migrateParams(design.params as Partial<BinParams>) }
      );

    // Sort by updatedAt descending
    migratedDesigns.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return ok(migratedDesigns);
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}

/**
 * Duplicate a design with a new ID.
 * Creates a copy with "Copy of {name}" as the name.
 *
 * @param id - The ID of the design to duplicate
 * @returns The duplicated design with a new ID
 */
export async function duplicateDesign(id: DesignId): Promise<Result<SavedDesign, StorageError>> {
  const loadResult = await loadDesign(id);
  if (isErr(loadResult)) {
    return loadResult;
  }

  const original = loadResult.value;
  const newName = `Copy of ${original.name}`;

  return saveDesign({
    name: newName,
    kind: original.kind,
    params: original.params ? { ...original.params } : undefined,
    envelope: original.envelope,
    structure: original.structure,
    thumbnail: original.thumbnail,
    exportFileNameConfig: original.exportFileNameConfig
      ? { ...original.exportFileNameConfig }
      : null,
    tags: original.tags,
    // publishedId intentionally not carried: it identifies a specific
    // published community record, and the copy is a new, unpublished design.
    // Lineage describes where the content came from, which is still true of
    // the copy, so it carries forward like tags.
    lineage: original.lineage,
  });
}

/**
 * Create an independent design seeded from one of a design's stored versions.
 *
 * A branch is a plain `SavedDesign`: it diverges the moment it exists and
 * nothing propagates across the link afterwards. `parentDesignId` records where
 * it came from so the library can show the family, which is the whole point of
 * branching rather than duplicating.
 *
 * `publishedId` is deliberately not carried, for the same reason
 * {@link duplicateDesign} drops it: it names a specific published record, and a
 * branch is a new unpublished design.
 */
export async function branchFromVersion(
  designId: DesignId,
  versionId: string,
  name: string
): Promise<Result<SavedDesign, StorageError>> {
  const parentResult = await loadDesign(designId);
  if (isErr(parentResult)) return parentResult;
  const parent = parentResult.value;

  // Membership is checked before the read: `readDesignVersion` will happily
  // return any version by id, so without this a mismatched pair would seed the
  // branch from unrelated content and still stamp it as this design's child.
  const versionsResult = await listDesignVersions(designId);
  if (isErr(versionsResult)) return versionsResult;
  const summary = versionsResult.value.find((v) => v.id === versionId);
  if (!summary) {
    return err(storageNotFound(`Version '${versionId}' does not belong to design '${designId}'`));
  }
  const versionName = summary.name;

  const versionResult = await readDesignVersion(versionId);
  if (isErr(versionResult)) return versionResult;
  const content = versionResult.value;

  const kind = (content.kind as SavedDesign['kind']) ?? 'bin';
  return saveDesign({
    name,
    // Content comes from the VERSION, not the parent's current state.
    ...(kind === 'bin'
      ? { params: (content.params ?? parent.params) as BinParams }
      : {
          kind,
          envelope: content.envelope as SavedDesign['envelope'],
          structure: content.structure as SavedDesign['structure'],
        }),
    // The parent's thumbnail renders the state the branch was taken away from,
    // so the regenerator draws the branch's own geometry instead.
    thumbnail: null,
    exportFileNameConfig: parent.exportFileNameConfig ? { ...parent.exportFileNameConfig } : null,
    tags: parent.tags,
    lineage: parent.lineage,
    parentDesignId: designId,
    parentVersionId: versionId,
    ...(versionName ? { parentVersionName: versionName } : {}),
  });
}

/**
 * Record a successful community publish on the local design so update mode
 * and cross-device sync see it.
 */
export async function setDesignPublishedId(
  id: DesignId,
  publishedId: string
): Promise<Result<SavedDesign, StorageError>> {
  const loadResult = await loadDesign(id);
  if (isErr(loadResult)) {
    return loadResult;
  }
  return saveDesign({
    ...loadResult.value,
    publishedId,
  });
}

/**
 * Drop a stale community publish id (the published record no longer exists
 * or is no longer owned). Persists `null` so the cleared state syncs.
 */
export async function clearDesignPublishedId(
  id: DesignId
): Promise<Result<SavedDesign, StorageError>> {
  const loadResult = await loadDesign(id);
  if (isErr(loadResult)) {
    return loadResult;
  }
  const current = loadResult.value;
  if (current.publishedId === undefined || current.publishedId === null) {
    return loadResult;
  }
  return saveDesign({
    ...current,
    publishedId: null,
  });
}

/**
 * Delete a design by ID.
 */
export async function deleteDesign(id: DesignId): Promise<Result<void, StorageError>> {
  try {
    const db = await getDb();
    const exists: unknown = await db.get(DESIGNS_STORE, id);

    if (!exists) {
      return err(storageNotFound(`Design '${id}' not found`));
    }

    await db.delete(DESIGNS_STORE, id);
    // Versions are keyed to a design; left behind they are unreachable rows that
    // still occupy the store. Failure here must not fail the delete — the design
    // is already gone, and reporting an error would invite a retry that then
    // reports "not found".
    await deleteVersionsForDesign(id);
    emitDesignerEvent({ type: 'delete', id, deletedAt: new Date().toISOString() });
    return ok(undefined);
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}

/**
 * Update only the name of an existing design.
 *
 * @param id - The design ID
 * @param name - The new design name
 * @returns A `Result` with the updated `SavedDesign` on success, or a `StorageError` on failure
 */
export async function updateDesignName(
  id: DesignId,
  name: string
): Promise<Result<SavedDesign, StorageError>> {
  const loadResult = await loadDesign(id);
  if (isErr(loadResult)) {
    return loadResult;
  }

  return saveDesign({
    ...loadResult.value,
    name,
  });
}

/**
 * Replace the tag set on an existing design. Tags are normalized (trimmed,
 * deduped, capped) before persisting.
 *
 * @param id - The design ID
 * @param tags - The new tag list (raw; normalized on save)
 * @returns A `Result` with the updated `SavedDesign` on success, or a `StorageError` on failure
 */
export async function updateDesignTags(
  id: DesignId,
  tags: readonly string[]
): Promise<Result<SavedDesign, StorageError>> {
  const loadResult = await loadDesign(id);
  if (isErr(loadResult)) {
    return loadResult;
  }

  // saveDesign normalizes tags; pass them through raw like updateDesignName.
  return saveDesign({
    ...loadResult.value,
    tags,
  });
}

/**
 * Update an existing design's bin parameters, thumbnail, and/or export config.
 *
 * If `thumbnail` is `undefined` the design's thumbnail is left unchanged; if `null` the thumbnail is cleared.
 * If `exportFileNameConfig` is `undefined` it is left unchanged.
 *
 * @param thumbnail - The new thumbnail data, `null` to remove it, or `undefined` to keep the current thumbnail
 * @param exportFileNameConfig - The new export config, or `undefined` to keep the current config
 * @returns A `Result` with the updated `SavedDesign` on success, or a `StorageError` on failure
 */
export async function updateDesignParams(
  id: DesignId,
  params: BinParams,
  thumbnail?: string | null,
  exportFileNameConfig?: ExportFileNameConfig
): Promise<Result<SavedDesign, StorageError>> {
  const loadResult = await loadDesign(id);
  if (isErr(loadResult)) {
    return loadResult;
  }

  return saveDesign({
    ...loadResult.value,
    params,
    ...(thumbnail !== undefined ? { thumbnail } : {}),
    ...(exportFileNameConfig !== undefined ? { exportFileNameConfig } : {}),
  });
}

/**
 * Update only the thumbnail for an existing design.
 *
 * Used when a design is created before the mesh is ready (e.g., from layout
 * planner "Create Design" flow) and we need to update the thumbnail after
 * the first successful mesh generation.
 *
 * @param id - The design ID
 * @param thumbnail - The new thumbnail data URL
 * @returns A `Result` with the updated `SavedDesign` on success
 */
export async function updateDesignThumbnail(
  id: DesignId,
  thumbnail: string
): Promise<Result<SavedDesign, StorageError>> {
  const loadResult = await loadDesign(id);
  if (isErr(loadResult)) {
    return loadResult;
  }

  return saveDesign({
    ...loadResult.value,
    thumbnail,
  });
}
/**
 * Get the active design ID from localStorage.
 * Returns null if no active design is set.
 */
export function getActiveDesignId(): DesignId | null {
  try {
    const raw = localStorage.getItem(ACTIVE_DESIGN_KEY);
    return raw !== null ? designId(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Save the active design ID to localStorage.
 * Pass null to clear the active design.
 */
export function setActiveDesignId(id: DesignId | null): void {
  try {
    if (id === null) {
      localStorage.removeItem(ACTIVE_DESIGN_KEY);
    } else {
      localStorage.setItem(ACTIVE_DESIGN_KEY, id);
    }
  } catch {
    // Storage unavailable - silently fail
  }
}

/**
 * Create a new design with default parameters and save it to IndexedDB.
 * Returns the saved design.
 */
export async function createNewDesign(
  name: string = 'Untitled Bin'
): Promise<Result<SavedDesign, StorageError>> {
  return saveDesign({
    name,
    params: { ...DEFAULT_BIN_PARAMS },
    thumbnail: null,
    exportFileNameConfig: { ...DEFAULT_EXPORT_FILE_NAME_CONFIG },
  });
}

/**
 * Initialize the designer storage system.
 *
 * Similar to how the grid editor's initializeLayoutLibrary() works:
 * - If there's an active design ID saved, try to load it
 * - If loading fails or no active design, create a new one
 * - Always returns a valid SavedDesign
 *
 * @returns The active design (loaded or newly created)
 */
export async function initializeDesigner(): Promise<Result<SavedDesign, StorageError>> {
  // Try to load the previously active design
  const activeId = getActiveDesignId();
  if (activeId) {
    const loadResult = await loadDesign(activeId);
    if (!isErr(loadResult)) {
      return loadResult;
    }
    // Active design not found - clear the stale reference
    setActiveDesignId(null);
  }

  // No active design or failed to load - create a new one
  const createResult = await createNewDesign();
  if (!isErr(createResult)) {
    setActiveDesignId(createResult.value.id);
  }
  return createResult;
}
