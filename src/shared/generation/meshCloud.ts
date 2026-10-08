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
/** Bumped when the signed-in session ends; a reply from before it is ignored. */
let sessionEpoch = 0;
/**
 * False from a session's end until the next one begins. A pull can still be
 * finishing for the ended session (the sign-in claim runs on after sign-out
 * cancels it), and what it asks for must not start under no account or the
 * next one.
 */
let sessionOpen = true;

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

// A sign-in claim queues a push for every design at once, and each can carry a
// whole mesh, so uploads share a few slots across every push.
const UPLOADS_AT_ONCE = 4;
let uploadsRunning = 0;
const uploadSlotWaiters: (() => void)[] = [];

function takeUploadSlot(): Promise<void> {
  if (uploadsRunning < UPLOADS_AT_ONCE) {
    uploadsRunning++;
    return Promise.resolve();
  }
  return new Promise((resolve) => uploadSlotWaiters.push(resolve));
}

// The session's end frees every slot, so a request of an ended session that
// never settles cannot hold one into the next.
function releaseUploadSlot(epoch: number): void {
  if (epoch !== sessionEpoch) return;
  const next = uploadSlotWaiters.shift();
  if (next) next();
  else uploadsRunning--;
}

// A request that never reaches the server rejects, as a push's own request
// does, so being offline leaves the push queued without spending a retry. So
// does an upload whose session ended mid-way, or while it waited for a slot:
// nothing of it may go on, or vouch for a file, under the next account.
// A request that hangs would hold its slot, and every transfer queued behind
// it, for as long as the browser allows; past this it is abandoned like a lost
// connection.
const REQUEST_TIMEOUT_MS = 60_000;

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function upload(hash: string, epoch: number): Promise<FileUpload> {
  const current = (): void => {
    if (epoch !== sessionEpoch || !sessionOpen) throw new Error('mesh upload: session ended');
  };
  await takeUploadSlot();
  try {
    current();
    const now = Date.now();
    if (now < unavailableUntil) return UNAVAILABLE;
    if (now < (refusedUntil.get(hash) ?? 0)) return REFUSED;
    const head = await withTimeout((signal) =>
      apiFetch(meshPath(hash), { method: 'HEAD', signal })
    );
    current();
    if (head.status !== 404) return outcome(head, hash);
    const bytes = await getMeshFile(hash);
    current();
    if (!bytes) return { status: 'missing', hash };
    const put = await withTimeout((signal) =>
      apiFetch(meshPath(hash), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: bytes,
        signal,
      })
    );
    current();
    return outcome(put, hash);
  } finally {
    releaseUploadSlot(epoch);
  }
}

function uploadOnce(hash: string): Promise<FileUpload> {
  let pending = uploads.get(hash);
  if (!pending) {
    const started = upload(hash, sessionEpoch);
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
export async function uploadMeshFiles(
  hashes: readonly string[],
  session: number = sessionEpoch
): Promise<MeshUpload> {
  if (session !== sessionEpoch || !sessionOpen) throw new Error('mesh upload: session ended');
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

/**
 * Whether a payload naming `hashes` can name them by ref: the account holds
 * every file, uploading under `session` those it lacks. False sends the meshes
 * inline, as does a payload with no file to name.
 */
export async function accountHoldsMeshFiles(
  hashes: readonly string[],
  session: number
): Promise<boolean> {
  if (hashes.length === 0) return false;
  try {
    return (await uploadMeshFiles(hashes, session)).status === 'held';
  } catch {
    return false;
  }
}

export async function readMissingMeshes(response: Response): Promise<string[]> {
  try {
    const { missing } = (await response.json()) as { missing?: unknown };
    return Array.isArray(missing) ? missing.filter((m): m is string => typeof m === 'string') : [];
  } catch {
    return [];
  }
}

const MESH_HASH = /^[0-9a-f]{64}$/;

export function parseMeshFiles(raw: unknown): Record<string, string> | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const files = Object.entries(raw).filter(
    (entry): entry is [string, string] =>
      MESH_HASH.test(entry[0]) && typeof entry[1] === 'string' && entry[1].startsWith('https://')
  );
  return files.length > 0 ? Object.fromEntries(files) : undefined;
}

// One queue for every caller, few at a time: a device new to an account can
// lack thousands of files, more than the server answers per minute.
const DOWNLOADS_AT_ONCE = 4;
const RETRY_FIRST_MS = 60_000;
const RETRY_LONGEST_MS = 30 * 60_000;

type Download = 'stored' | 'failed' | 'ended' | { readonly retryAfterMs: number };

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
/**
 * CDN URLs a share named for its files. They are public and the bytes are
 * checked against the hash, so they outlive any session, and a download
 * through one needs no account to hold the file.
 */
const sharedUrls = new Map<string, string>();

async function fetchVerified(hash: string, url: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const bytes = await withTimeout(async (signal) => {
    const res = await fetch(url, { signal });
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  });
  return bytes && (await sha256Hex(bytes)) === hash ? bytes : null;
}

// A download whose session ended stops before its next request or store: a
// HEAD sent signed out answers 401, which forces a sign-out that clears the
// outbox, and a file stored now would land under the next account.
async function download(hash: string, epoch: number): Promise<Download> {
  const ended = (): boolean => epoch !== sessionEpoch;
  try {
    if (await hasMeshFile(hash)) return 'stored';
    if (ended()) return 'ended';
    let url = sharedUrls.get(hash) ?? null;
    if (url === null) {
      const head = await withTimeout((signal) =>
        apiFetch(meshPath(hash), { method: 'HEAD', signal })
      );
      if (ended()) return 'ended';
      if (head.status === 429) {
        return { retryAfterMs: parseRetryAfter(head.headers.get('Retry-After')) ?? RETRY_FIRST_MS };
      }
      url = head.ok ? head.headers.get(MESH_URL_HEADER) : null;
      if (!url) return 'failed';
    }
    const bytes = await fetchVerified(hash, url);
    if (ended()) return 'ended';
    return bytes && (await putMeshFile(bytes)) !== null ? 'stored' : 'failed';
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
    const epoch = sessionEpoch;
    void download(hash, epoch).then((result) => {
      // The session's end reset the counts and dropped the waiters.
      if (result === 'ended' || epoch !== sessionEpoch) return;
      downloadsRunning--;
      if (result === 'stored') {
        failedDownloads.delete(hash);
        if (failedDownloads.size === 0) retryDelayMs = RETRY_FIRST_MS;
      } else {
        failedDownloads.add(hash);
        if (typeof result === 'object') {
          throttledUntil = Math.max(throttledUntil, Date.now() + result.retryAfterMs);
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
 * file has been tried or put off, and at once between sessions. Never rejects.
 */
export function fetchMeshFiles(
  hashes: readonly string[],
  session: number = sessionEpoch
): Promise<void> {
  if (!sessionOpen || session !== sessionEpoch) return Promise.resolve();
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
 * Store each file a share names that this device lacks, read straight from the
 * CDN URL the share gives, a few at a time. No account is asked, so a
 * signed-out recipient gets the files too, and a later download of one through
 * {@link fetchMeshFiles} uses the URL as well. A file that fails is tried
 * again on a timer that backs off like the account's; until then its pocket
 * stays pending. Never rejects.
 */
export async function fetchSharedMeshFiles(files: Readonly<Record<string, string>>): Promise<void> {
  for (const [hash, url] of Object.entries(files)) sharedUrls.set(hash, url);
  await downloadShared(Object.keys(files));
}

const sharedFailed = new Set<string>();
let sharedRetryTimer: ReturnType<typeof setTimeout> | null = null;
let sharedRetryDelayMs = RETRY_FIRST_MS;

async function storeShared(hash: string, url: string): Promise<boolean> {
  try {
    if (await hasMeshFile(hash)) return true;
    const bytes = await fetchVerified(hash, url);
    return bytes !== null && (await putMeshFile(bytes)) !== null;
  } catch {
    return false;
  }
}

async function downloadShared(hashes: readonly string[]): Promise<void> {
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < hashes.length) {
      const hash = hashes[next++];
      const url = sharedUrls.get(hash);
      if (url !== undefined && (await storeShared(hash, url))) sharedFailed.delete(hash);
      else sharedFailed.add(hash);
    }
  };
  await Promise.all(Array.from({ length: Math.min(DOWNLOADS_AT_ONCE, hashes.length) }, worker));
  if (sharedFailed.size === 0) {
    sharedRetryDelayMs = RETRY_FIRST_MS;
    return;
  }
  if (sharedRetryTimer !== null) return;
  sharedRetryTimer = setTimeout(() => {
    sharedRetryTimer = null;
    sharedRetryDelayMs = Math.min(RETRY_LONGEST_MS, sharedRetryDelayMs * 2);
    void downloadShared([...sharedFailed]);
  }, sharedRetryDelayMs);
}

/**
 * The session now running. Work begun under it passes this to
 * {@link fetchMeshFiles}, which ignores it once a later session has begun.
 */
export function meshCloudSession(): number {
  return sessionEpoch;
}

/** Take uploads and downloads again, for the signed-in session starting now. */
export function beginMeshCloudSession(): void {
  sessionOpen = true;
}

/**
 * Forget what the ended session's account holds and refused, drop every queued
 * download and the retry timer (a retry after it would ask the server
 * anonymously), refuse the uploads waiting for a slot, and take no new upload
 * or download until {@link beginMeshCloudSession}.
 */
export function endMeshCloudSession(): void {
  sessionOpen = false;
  sessionEpoch++;
  uploads.clear();
  uploadsRunning = 0;
  for (const wake of uploadSlotWaiters.splice(0)) wake();
  unavailableUntil = 0;
  refusedUntil.clear();
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
  sharedUrls.clear();
  sharedFailed.clear();
  if (sharedRetryTimer !== null) clearTimeout(sharedRetryTimer);
  sharedRetryTimer = null;
  sharedRetryDelayMs = RETRY_FIRST_MS;
  endMeshCloudSession();
  beginMeshCloudSession();
}
