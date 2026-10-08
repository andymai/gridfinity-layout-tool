/**
 * Mesh files between this device and the signed-in account's mesh store on the
 * server (`/api/meshes/{hash}`), whose files are read from the Blob CDN.
 */

import { apiFetch } from '@/core/sync/apiFetch';
import { parseRetryAfter } from '@/core/sync/retryAfter';
import { getMeshFile, hasMeshFile, putMeshFile } from './meshStore';
import { sha256Hex } from './sha256';

/** MIRROR: `MESH_URL_HEADER` in `api/meshes/[hash].ts`. */
export const MESH_URL_HEADER = 'X-Mesh-Url';

// A server without a mesh store, or one that will not take a file (an account
// over its mesh quota, say), is taken at its word for a while: asking again
// would add a request, or a whole upload, to every save.
const INLINE_RECHECK_MS = 10 * 60_000;
let unavailableUntil = 0;
const refusedUntil = new Map<string, number>();

export type MeshUpload =
  | { readonly status: 'held' }
  /** Send the mesh inline: the server has no mesh store, or will not take the file. */
  | { readonly status: 'unavailable' }
  /** On neither the server nor this device. */
  | { readonly status: 'missing'; readonly hash: string }
  /** The server is rate limiting; `retryAfterMs` is null when it gave no delay. */
  | { readonly status: 'throttled'; readonly retryAfterMs: number | null }
  | { readonly status: 'failed'; readonly reason: string };

const HELD: MeshUpload = { status: 'held' };
const UNAVAILABLE: MeshUpload = { status: 'unavailable' };

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

function outcome(res: Response, hash: string): MeshUpload {
  if (res.ok) return HELD;
  if (res.status === 503) {
    unavailableUntil = Date.now() + INLINE_RECHECK_MS;
    return UNAVAILABLE;
  }
  if (res.status === 429) {
    return { status: 'throttled', retryAfterMs: parseRetryAfter(res.headers.get('Retry-After')) };
  }
  if (res.status >= 400 && res.status < 500) {
    refusedUntil.set(hash, Date.now() + INLINE_RECHECK_MS);
    return UNAVAILABLE;
  }
  return { status: 'failed', reason: `mesh upload: HTTP ${res.status}` };
}

// A request that never reaches the server rejects, as a push's own request
// does, so being offline leaves the push queued without spending a retry.
async function upload(hash: string): Promise<MeshUpload> {
  const now = Date.now();
  if (now < unavailableUntil || now < (refusedUntil.get(hash) ?? 0)) return UNAVAILABLE;
  const head = await apiFetch(meshPath(hash), { method: 'HEAD' });
  if (head.status !== 404) return outcome(head, hash);
  const bytes = await getMeshFile(hash);
  if (!bytes) return { status: 'missing', hash };
  return outcome(
    await apiFetch(meshPath(hash), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: bytes,
    }),
    hash
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

// Few at a time: a device new to an account can lack thousands of files, more
// than the server answers per minute.
const DOWNLOADS_AT_ONCE = 4;
const RETRY_FIRST_MS = 60_000;
const RETRY_LONGEST_MS = 30 * 60_000;

type Download = 'stored' | 'failed' | { readonly retryAfterMs: number };

const downloading = new Set<string>();
/** Files whose download failed; only the scheduled retry asks for them again. */
const failedDownloads = new Set<string>();
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelayMs = RETRY_FIRST_MS;

async function download(hash: string): Promise<Download> {
  try {
    if (await hasMeshFile(hash)) return 'stored';
    const head = await apiFetch(meshPath(hash), { method: 'HEAD' });
    if (head.status === 429) {
      return { retryAfterMs: parseRetryAfter(head.headers.get('Retry-After')) ?? RETRY_FIRST_MS };
    }
    const url = head.ok ? head.headers.get(MESH_URL_HEADER) : null;
    if (!url) return 'failed';
    const res = await fetch(url);
    if (!res.ok) return 'failed';
    const bytes = new Uint8Array(await res.arrayBuffer());
    const stored = (await sha256Hex(bytes)) === hash && (await putMeshFile(bytes)) !== null;
    return stored ? 'stored' : 'failed';
  } catch {
    return 'failed';
  }
}

function retryFailedDownloads(delayMs: number): void {
  if (retryTimer !== null) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void downloadAll([...failedDownloads], true);
  }, delayMs);
}

async function downloadAll(hashes: readonly string[], retrying: boolean): Promise<void> {
  const queue = [...new Set(hashes)].filter(
    (hash) => !downloading.has(hash) && (retrying || !failedDownloads.has(hash))
  );
  for (const hash of queue) downloading.add(hash);
  let throttledMs = 0;
  const work = async (): Promise<void> => {
    for (let hash = queue.shift(); hash !== undefined; hash = queue.shift()) {
      // Once the server throttles, the rest of the batch waits for the retry.
      const result = throttledMs > 0 ? 'failed' : await download(hash);
      downloading.delete(hash);
      if (result === 'stored') {
        failedDownloads.delete(hash);
        continue;
      }
      failedDownloads.add(hash);
      if (typeof result === 'object') throttledMs = Math.max(throttledMs, result.retryAfterMs);
    }
  };
  await Promise.all(Array.from({ length: DOWNLOADS_AT_ONCE }, work));
  if (failedDownloads.size === 0) {
    retryDelayMs = RETRY_FIRST_MS;
  } else if (throttledMs > 0) {
    retryFailedDownloads(throttledMs);
  } else {
    if (retrying) retryDelayMs = Math.min(RETRY_LONGEST_MS, retryDelayMs * 2);
    retryFailedDownloads(retryDelayMs);
  }
}

/**
 * Fetch each file in `hashes` this device lacks, a few at a time; its arrival
 * is announced like any stored file's. A file that fails is tried again on a
 * timer that backs off to half an hour, and a throttled server is waited out;
 * until then its pocket stays pending. Never rejects.
 */
export function fetchMeshFiles(hashes: readonly string[]): Promise<void> {
  return downloadAll(hashes, false);
}

/** Test-only: forget every held file, upload and download, and the retry timer. */
export function __resetMeshCloudForTests(): void {
  uploads.clear();
  unavailableUntil = 0;
  refusedUntil.clear();
  downloading.clear();
  failedDownloads.clear();
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = null;
  retryDelayMs = RETRY_FIRST_MS;
}
