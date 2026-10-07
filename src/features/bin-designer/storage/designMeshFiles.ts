/**
 * Upkeep of the mesh files stored designs and versions name: moving inline
 * meshes into the mesh store, and sweeping files that nothing names any more.
 *
 * Neither touches `updatedAt` or announces a change: the records' content is
 * unchanged, only how their meshes are kept, and sync payloads built from refs
 * are byte for byte the inline ones.
 */

import type { DesignVersion, SavedDesign } from '@/features/bin-designer/types';
import { holderMeshHashes, storeHolderMeshes } from '@/shared/generation/meshRefs';
import type { MeshHolder } from '@/shared/generation/meshRefs';
import { sweepMeshFiles } from '@/shared/generation/meshStore';
import { compressString, decompressString } from '@/shared/utils/compression';
import { DESIGNS_STORE, DESIGN_VERSIONS_STORE, getDb } from './designerDb';

function versionBody(version: DesignVersion): MeshHolder | null {
  const json = decompressString(version.content);
  if (!json) return null;
  try {
    const body: unknown = JSON.parse(json);
    return typeof body === 'object' && body !== null ? body : null;
  } catch {
    return null;
  }
}

/**
 * Write `next` over `previous` unless the record moved on in between: a save
 * that landed meanwhile stored its own meshes, and must not be undone.
 */
async function replaceUnchanged<T extends { readonly id: string }>(
  storeName: string,
  previous: T,
  next: T,
  same: (stored: T, previous: T) => boolean
): Promise<boolean> {
  const db = await getDb();
  const tx = db.transaction(storeName, 'readwrite');
  const stored = (await tx.store.get(previous.id)) as T | undefined;
  const write = stored !== undefined && same(stored, previous);
  if (write) void tx.store.put(next);
  await tx.done;
  return write;
}

/**
 * Store every inline mesh in saved designs and versions as a file and rewrite
 * the record with refs. Idempotent; a record whose meshes cannot be stored
 * stays as it is. Answers how many records were rewritten.
 */
export async function moveInlineMeshesToFiles(): Promise<number> {
  const db = await getDb();
  let rewritten = 0;

  for (const design of (await db.getAll(DESIGNS_STORE)) as SavedDesign[]) {
    const stored = await storeHolderMeshes(design);
    if (
      stored !== design &&
      (await replaceUnchanged(DESIGNS_STORE, design, stored, (a, b) => a.updatedAt === b.updatedAt))
    ) {
      rewritten++;
    }
  }

  for (const version of (await db.getAll(DESIGN_VERSIONS_STORE)) as DesignVersion[]) {
    const body = versionBody(version);
    if (!body) continue;
    const stored = await storeHolderMeshes(body);
    if (stored === body) continue;
    const next: DesignVersion = { ...version, content: compressString(JSON.stringify(stored)) };
    if (
      await replaceUnchanged(
        DESIGN_VERSIONS_STORE,
        version,
        next,
        (a, b) => a.content === b.content
      )
    ) {
      rewritten++;
    }
  }
  return rewritten;
}

/** Every mesh file a saved design or version names. */
export async function referencedMeshHashes(): Promise<Set<string>> {
  const db = await getDb();
  const hashes = new Set<string>();
  for (const design of (await db.getAll(DESIGNS_STORE)) as SavedDesign[]) {
    for (const hash of holderMeshHashes(design)) hashes.add(hash);
  }
  for (const version of (await db.getAll(DESIGN_VERSIONS_STORE)) as DesignVersion[]) {
    const body = versionBody(version);
    if (body) for (const hash of holderMeshHashes(body)) hashes.add(hash);
  }
  return hashes;
}

/**
 * Move inline meshes into files, then delete the files nothing names. A failed
 * read of the designs rejects before anything is swept.
 */
export async function maintainMeshFiles(): Promise<void> {
  await moveInlineMeshesToFiles();
  await sweepMeshFiles(await referencedMeshHashes());
}
