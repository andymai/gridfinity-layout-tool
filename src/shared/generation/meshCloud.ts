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
  /** The server has no mesh store: send every mesh inline. */
  | { readonly status: 'unavailable' }
  /** The server will not take these files: send them inline, the rest as refs. */
  | { readonly status: 'refused'; readonly hashes: readonly string[] }
  /** On neither the server nor this device. */
  | { readonly status: 'missing'; readonly hash: string }
  /** The server is rate limiting; `retryAfterMs` is null when it gave no delay. */
  | { readonly status: 'throttled'; readonly retryAfterMs: number | null }
  | { readonly status: 'failed'; readonly reason: string };

type FileUpload = Exclude<MeshUpload, { status: 'refused' }> | { readonly status: 'refused-file' };

const HELD = { status: 'held' } as const;
const UNAVAILABLE = { status: 'unavailable' } as const;
const REFUSED = { status: 'refused-file' } as const;

function isStatus<S extends FileUpload['status']>(status: S) {
  return (r: FileUpload): r is Extract<FileUpload, { status: S }> => r.status === status;
}

/**
 * Files the account holds, and uploads in flight. Only a shortcut: the server
 * checks every hash a push names and lists any it lacks for
 * {@link forgetHeldMeshes}, so an entry gone stale (another account's, after a
 * sign-in on this page) costs one deferred push.
 */
const uploads = new Map<string, Promise<FileUpload>>();

function meshPath(hash: string): string {
  return `/api/meshes/${hash}`;
}

function outcome(res: Response, hash: string): FileUpload {
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
    return REFUSED;
  }
  return { status: 'failed', reason: `mesh upload: HTTP ${res.status}` };
}

// A request that never reaches the server rejects, as a push's own request
// does, so being offline leaves the push queued without spending a retry.
async function upload(hash: string): Promise<FileUpload> {
  const now = Date.now();
  if (now < unavailableUntil) return UNAVAILABLE;
  if (now < (refusedUntil.get(hash) ?? 0)) return REFUSED;
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

function uploadOnce(hash: string): Promise<FileUpload> {
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
 * one it lacks. Answers what stops the push from naming them all by ref, most
 * pressing first, and rejects when the server cannot be reached.
 */
export async function uploadMeshFiles(hashes: readonly string[]): Promise<MeshUpload> {
  const unique = [...new Set(hashes)];
  const results = await Promise.all(unique.map(uploadOnce));
  const missing = results.find(isStatus('missing'));
  if (missing) return missing;
  const waits = results.flatMap((r) => (r.status === 'throttled' ? [r.retryAfterMs] : []));
  if (waits.length > 0) {
    const known = waits.filter((ms): ms is number => ms !== null);
    return { status: 'throttled', retryAfterMs: known.length > 0 ? Math.max(...known) : null };
  }
  const failed = results.find(isStatus('failed'));
  if (failed) return failed;
  if (results.some((r) => r.status === 'unavailable')) return UNAVAILABLE;
  const refused = unique.filter((_, i) => results[i].status === 'refused-file');
  return refused.length > 0 ? { status: 'refused', hashes: refused } : HELD;
}

export function forgetHeldMeshes(hashes: readonly string[]): void {
  for (const hash of hashes) uploads.delete(hash);
}

// One queue for every caller, few at a time: a device new to an account can
// lack thousands of files, more than the server answers per minute.
const DOWNLOADS_AT_ONCE = 4;
const RETRY_FIRST_MS = 60_000;
const RETRY_LONGEST_MS = 30 * 60_000;

type Download = 'stored' | 'failed' | { readonly retryAfterMs: number };

const downloadQueue: string[] = [];
/** Every file queued or downloading, with the calls waiting on its attempt. */
const downloadWaiters = new Map<string, (() => void)[]>();
/** Files whose download failed; only the scheduled retry asks for them again. */
const failedDownloads = new Set<string>();
let downloadsRunning = 0;
let throttledUntil = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAt = 0;
let retryDelayMs = RETRY_FIRST_MS;
let downloadEpoch = 0;

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

function settleDownload(hash: string): void {
  for (const waiter of downloadWaiters.get(hash) ?? []) waiter();
  downloadWaiters.delete(hash);
}

// A throttle may only push the retry later: an earlier timer would ask again
// before the server said to.
function scheduleRetry(delayMs: number, throttle: boolean): void {
  const at = Date.now() + delayMs;
  if (retryTimer !== null && (!throttle || at <= retryAt)) return;
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryAt = at;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    // Only a throttle can move this timer later, so its wait is over.
    throttledUntil = 0;
    retryDelayMs = Math.min(RETRY_LONGEST_MS, retryDelayMs * 2);
    const due = [...failedDownloads];
    failedDownloads.clear();
    for (const hash of due) void queueDownload(hash);
    pumpDownloads();
  }, delayMs);
}

function pumpDownloads(): void {
  while (downloadsRunning < DOWNLOADS_AT_ONCE && Date.now() >= throttledUntil) {
    const hash = downloadQueue.shift();
    if (hash === undefined) return;
    downloadsRunning++;
    const epoch = downloadEpoch;
    void download(hash).then((result) => {
      if (epoch !== downloadEpoch) return;
      downloadsRunning--;
      if (result === 'stored') {
        failedDownloads.delete(hash);
        if (failedDownloads.size === 0) retryDelayMs = RETRY_FIRST_MS;
      } else {
        failedDownloads.add(hash);
        if (typeof result === 'object') {
          throttledUntil = Date.now() + result.retryAfterMs;
          // The rest wait for the retry rather than ask a throttling server.
          for (const queued of downloadQueue.splice(0)) {
            failedDownloads.add(queued);
            settleDownload(queued);
          }
          scheduleRetry(result.retryAfterMs, true);
        } else {
          scheduleRetry(retryDelayMs, false);
        }
      }
      settleDownload(hash);
      pumpDownloads();
    });
  }
}

function queueDownload(hash: string): Promise<void> {
  return new Promise((resolve) => {
    const waiters = downloadWaiters.get(hash);
    if (waiters) {
      waiters.push(resolve);
      return;
    }
    downloadWaiters.set(hash, [resolve]);
    downloadQueue.push(hash);
  });
}

/**
 * Fetch each file in `hashes` this device lacks, a few at a time across every
 * caller; its arrival is announced like any stored file's. A file that fails
 * is tried again on a timer that backs off to half an hour, and a throttled
 * server is waited out; until then its pocket stays pending. Settles once each
 * file has been tried or put off. Never rejects.
 */
export function fetchMeshFiles(hashes: readonly string[]): Promise<void> {
  const wanted = [...new Set(hashes)].filter((hash) => !failedDownloads.has(hash));
  if (Date.now() < throttledUntil) {
    for (const hash of wanted) if (!downloadWaiters.has(hash)) failedDownloads.add(hash);
    return Promise.resolve();
  }
  const tried = wanted.map(queueDownload);
  pumpDownloads();
  return Promise.all(tried).then(() => undefined);
}

/**
 * Drop every queued download and the retry timer. Called when the signed-in
 * session ends: a retry after it would ask the server anonymously.
 */
export function cancelMeshDownloads(): void {
  downloadEpoch++;
  for (const hash of downloadQueue.splice(0)) settleDownload(hash);
  for (const hash of [...downloadWaiters.keys()]) settleDownload(hash);
  failedDownloads.clear();
  downloadsRunning = 0;
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = null;
  retryAt = 0;
  throttledUntil = 0;
  retryDelayMs = RETRY_FIRST_MS;
}

/** Test-only: forget every held file, upload and download, and the retry timer. */
export function __resetMeshCloudForTests(): void {
  uploads.clear();
  unavailableUntil = 0;
  refusedUntil.clear();
  cancelMeshDownloads();
}
