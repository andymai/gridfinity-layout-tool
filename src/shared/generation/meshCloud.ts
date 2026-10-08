/**
 * Mesh files between this device and the signed-in account's mesh store on the
 * server (`/api/meshes/{hash}`), whose files are read from the Blob CDN.
 */

import { apiFetch } from '@/core/sync/apiFetch';
import { getMeshFile, hasMeshFile, putMeshFile } from './meshStore';
import { sha256Hex } from './sha256';

/** MIRROR: `MESH_URL_HEADER` in `api/meshes/[hash].ts`. */
export const MESH_URL_HEADER = 'X-Mesh-Url';

const FETCH_RETRY_MS = 60_000;

// A server without a mesh store is taken at its word for a while: asking again
// per file would add a request for every mesh to every save.
const UNAVAILABLE_RECHECK_MS = 10 * 60_000;
let unavailableUntil = 0;

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
  if (res.status === 503) {
    unavailableUntil = Date.now() + UNAVAILABLE_RECHECK_MS;
    return { status: 'unavailable' };
  }
  return { status: 'failed', reason: `mesh upload: HTTP ${res.status}` };
}

// A request that never reaches the server rejects, as a push's own request
// does, so being offline leaves the push queued without spending a retry.
async function upload(hash: string): Promise<MeshUpload> {
  if (Date.now() < unavailableUntil) return { status: 'unavailable' };
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
}

function uploadOnce(hash: string): Promise<MeshUpload> {
  let pending = uploads.get(hash);
  if (!pending) {
    const started = upload(hash);
    uploads.set(hash, started);
    const settle = (held: boolean): void => {
      if (!held && uploads.get(hash) === started) uploads.delete(hash);
    };
    started.then(
      (result) => settle(result === HELD),
      () => settle(false)
    );
    pending = started;
  }
  return pending;
}

/**
 * Have the account hold every file in `hashes`, uploading from this device each
 * one it lacks; answers the first that it does not end up holding, and rejects
 * when the server cannot be reached.
 */
export async function uploadMeshFiles(hashes: readonly string[]): Promise<MeshUpload> {
  const results = await Promise.all([...new Set(hashes)].map(uploadOnce));
  return results.find((result) => result !== HELD) ?? HELD;
}

export function forgetHeldMeshes(hashes: readonly string[]): void {
  for (const hash of hashes) uploads.delete(hash);
}

/** When each file last failed to arrive, or Infinity while it is on its way. */
const fetches = new Map<string, number>();

async function fetchMeshFile(hash: string): Promise<boolean> {
  try {
    if (await hasMeshFile(hash)) return true;
    const head = await apiFetch(meshPath(hash), { method: 'HEAD' });
    const url = head.ok ? head.headers.get(MESH_URL_HEADER) : null;
    if (!url) return false;
    const res = await fetch(url);
    if (!res.ok) return false;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return (await sha256Hex(bytes)) === hash && (await putMeshFile(bytes)) !== null;
  } catch {
    return false;
  }
}

/**
 * Fetch each file in `hashes` this device lacks; its arrival is announced like
 * any stored file's. One that fails waits for a later call, a minute on at the
 * soonest, and its pocket stays pending until then. Never rejects.
 */
export async function fetchMeshFiles(hashes: readonly string[]): Promise<void> {
  const started: Promise<void>[] = [];
  for (const hash of hashes) {
    if (Date.now() - (fetches.get(hash) ?? -Infinity) < FETCH_RETRY_MS) continue;
    fetches.set(hash, Infinity);
    started.push(
      fetchMeshFile(hash).then((stored) => {
        if (stored) fetches.delete(hash);
        else fetches.set(hash, Date.now());
      })
    );
  }
  await Promise.all(started);
}

/** Test-only: forget every held file, upload and fetch. */
export function __resetMeshCloudForTests(): void {
  uploads.clear();
  fetches.clear();
  unavailableUntil = 0;
}
