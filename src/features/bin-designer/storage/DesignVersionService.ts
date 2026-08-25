/**
 * Named version history for saved designs.
 *
 * Mirrors what `core/storage/SnapshotService` gives layouts, with two
 * deliberate differences:
 *
 *  - **Capture is manual.** Layouts snapshot on a timer; a design version is
 *    only written when the user asks for one, or automatically as the
 *    `pre-restore` safety copy taken before a restore overwrites the working
 *    state. There is no unlabeled churn to roll over, so eviction is keyed on
 *    {@link DesignVersion.origin} and `pinned` rather than on "has a label".
 *  - **The body is a `DesignVersionContent`,** not a `BinParams`, so non-bin
 *    item kinds version their `envelope`/`structure` correctly.
 */

import { compressString, decompressString } from '@/shared/utils/compression';
import type { DesignId } from '@/core/types';
import type { Result, StorageError } from '@/core/result';
import { ok, err, storageNotFound, storageUnavailable, storageCorrupted } from '@/core/result';
import type {
  DesignVersion,
  DesignVersionContent,
  DesignVersionOrigin,
  DesignVersionSummary,
} from '@/features/bin-designer/types';
import { MAX_VERSIONS_PER_DESIGN } from '@/features/bin-designer/types';
import { getDb, DESIGN_VERSIONS_STORE } from './designerDb';

/** Strip the compressed body so the history list never holds every design in memory. */
function toSummary(version: DesignVersion): DesignVersionSummary {
  const { content: _content, ...summary } = version;
  return summary;
}

function byNewest(a: DesignVersion, b: DesignVersion): number {
  return b.createdAt.localeCompare(a.createdAt);
}

async function readAll(designId: DesignId): Promise<DesignVersion[]> {
  const db = await getDb();
  const rows = (await db.getAllFromIndex(
    DESIGN_VERSIONS_STORE,
    'designId',
    designId
  )) as DesignVersion[];
  return rows.sort(byNewest);
}

/**
 * Versions this design would drop to make room for one more.
 *
 * Pinned versions never qualify. Among the rest, automatic `pre-restore`
 * captures go first however old they are: the user named one of these and not
 * the other, and dropping the named one while keeping a machine-made copy of a
 * state they deliberately moved away from is the wrong trade.
 */
function evictionOrder(existing: readonly DesignVersion[]): DesignVersion[] {
  return existing
    .filter((v) => !v.pinned)
    .sort((a, b) => {
      if (a.origin !== b.origin) return a.origin === 'pre-restore' ? -1 : 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
}

export interface CreateVersionResult {
  readonly version: DesignVersionSummary;
  /** Versions dropped to make room. The caller announces these; eviction is never silent. */
  readonly evicted: readonly DesignVersionSummary[];
}

/**
 * Capture the current state of a design as a named version.
 *
 * Enforces {@link MAX_VERSIONS_PER_DESIGN} by evicting in {@link evictionOrder}.
 * A design whose versions are all pinned is at its ceiling with nothing to drop;
 * the write still succeeds, because refusing to save is a worse answer than
 * exceeding a soft cap by the one version the user is actively trying to keep.
 */
export async function createDesignVersion(
  designId: DesignId,
  name: string,
  content: DesignVersionContent,
  thumbnail: string | null,
  origin: DesignVersionOrigin = 'manual'
): Promise<Result<CreateVersionResult, StorageError>> {
  try {
    const db = await getDb();
    const existing = await readAll(designId);

    const evicted: DesignVersionSummary[] = [];
    const overBy = existing.length - MAX_VERSIONS_PER_DESIGN + 1;
    if (overBy > 0) {
      for (const victim of evictionOrder(existing).slice(0, overBy)) {
        await db.delete(DESIGN_VERSIONS_STORE, victim.id);
        evicted.push(toSummary(victim));
      }
    }

    const version: DesignVersion = {
      id: crypto.randomUUID(),
      designId,
      name,
      content: compressString(JSON.stringify(content)),
      thumbnail,
      createdAt: new Date().toISOString(),
      origin,
    };
    await db.put(DESIGN_VERSIONS_STORE, version);

    return ok({ version: toSummary(version), evicted });
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}

export async function listDesignVersions(
  designId: DesignId
): Promise<Result<DesignVersionSummary[], StorageError>> {
  try {
    return ok((await readAll(designId)).map(toSummary));
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}

export async function readDesignVersion(
  versionId: string
): Promise<Result<DesignVersionContent, StorageError>> {
  try {
    const db = await getDb();
    const version = (await db.get(DESIGN_VERSIONS_STORE, versionId)) as DesignVersion | undefined;
    if (!version) return err(storageNotFound(versionId));

    const json = decompressString(version.content);
    if (!json) return err(storageCorrupted(versionId, ['version content failed to decompress']));
    // Parsed inside its own try: a body that decompresses but will not parse is
    // corruption, and reporting it as `indexedDB unavailable` sends the caller
    // to a retry that can never succeed.
    try {
      return ok(JSON.parse(json) as DesignVersionContent);
    } catch {
      return err(storageCorrupted(versionId, ['version content is not valid JSON']));
    }
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}

async function patch(
  versionId: string,
  fields: Partial<Pick<DesignVersion, 'name' | 'pinned'>>
): Promise<Result<DesignVersionSummary, StorageError>> {
  try {
    const db = await getDb();
    const existing = (await db.get(DESIGN_VERSIONS_STORE, versionId)) as DesignVersion | undefined;
    if (!existing) return err(storageNotFound(versionId));

    const updated: DesignVersion = { ...existing, ...fields };
    await db.put(DESIGN_VERSIONS_STORE, updated);
    return ok(toSummary(updated));
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}

export async function renameDesignVersion(
  versionId: string,
  name: string
): Promise<Result<DesignVersionSummary, StorageError>> {
  return patch(versionId, { name });
}

export async function setDesignVersionPinned(
  versionId: string,
  pinned: boolean
): Promise<Result<DesignVersionSummary, StorageError>> {
  return patch(versionId, { pinned });
}

export async function deleteDesignVersion(versionId: string): Promise<Result<void, StorageError>> {
  try {
    const db = await getDb();
    await db.delete(DESIGN_VERSIONS_STORE, versionId);
    return ok(undefined);
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}

/**
 * Drop every version of a design. Called when the design itself is deleted:
 * versions keyed to a design that no longer exists are unreachable rows that
 * would still occupy the store.
 */
export async function deleteVersionsForDesign(
  designId: DesignId
): Promise<Result<number, StorageError>> {
  try {
    const db = await getDb();
    const existing = await readAll(designId);
    for (const version of existing) {
      await db.delete(DESIGN_VERSIONS_STORE, version.id);
    }
    return ok(existing.length);
  } catch (e) {
    return err(storageUnavailable('indexedDB', e));
  }
}
