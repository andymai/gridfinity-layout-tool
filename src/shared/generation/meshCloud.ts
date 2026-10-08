/**
 * Mesh files between this device and the signed-in account's mesh store on the
 * server (`/api/meshes/{hash}`).
 */

import { apiFetch } from '@/core/sync/apiFetch';
import { getMeshFile } from './meshStore';

export type MeshUpload =
  | { readonly status: 'held' }
  /** The server has no mesh store. */
  | { readonly status: 'unavailable' }
  /** On neither the server nor this device. */
  | { readonly status: 'missing'; readonly hash: string }
  | { readonly status: 'failed'; readonly reason: string };

const HELD: MeshUpload = { status: 'held' };

/**
 * Files the account holds, and uploads in flight. Only a shortcut: the server
 * checks every hash a push names and lists any it lacks for
 * {@link forgetHeldMeshes}, so an entry gone stale (another account's, after a
 * sign-in on this page) costs one deferred push.
 */
const uploads = new Map<string, Promise<MeshUpload>>();

function meshPath(hash: string): string {
  return `/api/meshes/${hash}`;
}

function outcome(res: Response): MeshUpload {
  if (res.ok) return HELD;
  if (res.status === 503) return { status: 'unavailable' };
  return { status: 'failed', reason: `mesh upload: HTTP ${res.status}` };
}

async function upload(hash: string): Promise<MeshUpload> {
  try {
    const head = await apiFetch(meshPath(hash), { method: 'HEAD' });
    if (head.status !== 404) return outcome(head);
    const bytes = await getMeshFile(hash);
    if (!bytes) return { status: 'missing', hash };
    return outcome(
      await apiFetch(meshPath(hash), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: bytes,
      })
    );
  } catch (e) {
    return { status: 'failed', reason: `mesh upload: ${String(e)}` };
  }
}

function uploadOnce(hash: string): Promise<MeshUpload> {
  let pending = uploads.get(hash);
  if (!pending) {
    const started = upload(hash);
    uploads.set(hash, started);
    void started.then((result) => {
      if (result !== HELD && uploads.get(hash) === started) uploads.delete(hash);
    });
    pending = started;
  }
  return pending;
}

/**
 * Have the account hold every file in `hashes`, uploading from this device each
 * one it lacks; answers the first that it does not end up holding.
 */
export async function uploadMeshFiles(hashes: readonly string[]): Promise<MeshUpload> {
  const results = await Promise.all([...new Set(hashes)].map(uploadOnce));
  return results.find((result) => result !== HELD) ?? HELD;
}

export function forgetHeldMeshes(hashes: readonly string[]): void {
  for (const hash of hashes) uploads.delete(hash);
}

/** Test-only: forget every held file and upload. */
export function __resetMeshCloudForTests(): void {
  uploads.clear();
}
