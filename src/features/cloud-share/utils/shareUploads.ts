/**
 * Uploads from this tab to each share, one at a time. Both uploaders (a
 * collab room's and the owner's local one) go through here, and so does a
 * room that the owner left or opened again. A request that comes while an
 * upload runs waits, and a later request replaces it, so an older layout
 * never lands after a newer one from this tab.
 */

import { isOk, isRetryable, type ErrorCode, type Result } from '@/core/result';

/** The link's answer to a save that it took. */
export interface SavedUpload {
  readonly lastUpdatedAt?: string;
}

/** The save that the link took, or the error that it gave instead. */
export type UploadAnswer = Result<SavedUpload, { readonly code: ErrorCode }>;

export interface ShareUpload {
  /** The layout that the upload saves. Equal keys save equal layouts. */
  readonly key: string;
  readonly send: () => Promise<UploadAnswer>;
  /** Records a save of this layout, whichever request sent it. */
  readonly record: (saved: SavedUpload) => void;
}

/**
 * Waits before each new try of an upload that failed with a retryable error.
 * Both uploaders save only after an edit, so without a retry the link keeps
 * the older layout until the next edit.
 */
export const UPLOAD_RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000] as const;

interface ShareQueue {
  waiting: ShareUpload | null;
}

const queues = new Map<string, ShareQueue>();
const retries = new Map<string, ReturnType<typeof setTimeout>>();

function cancelRetry(shareId: string): void {
  const timer = retries.get(shareId);
  if (timer === undefined) return;
  clearTimeout(timer);
  retries.delete(shareId);
}

function start(shareId: string, upload: ShareUpload, attempt = 0): void {
  cancelRetry(shareId);
  const queue: ShareQueue = { waiting: null };
  queues.set(shareId, queue);
  void upload
    .send()
    .catch((): null => null)
    .then((answer) => {
      if (queues.get(shareId) !== queue) return;
      queues.delete(shareId);
      const saved = answer && isOk(answer) ? answer.value : null;
      if (saved) upload.record(saved);
      const next = queue.waiting;
      if (next) {
        // The request that sent this layout can be gone (a room that the
        // owner left), so the one that waits for it records the save.
        if (saved && next.key === upload.key) next.record(saved);
        else start(shareId, next);
        return;
      }
      if (
        answer &&
        !answer.ok &&
        isRetryable(answer.error.code) &&
        attempt < UPLOAD_RETRY_DELAYS_MS.length
      ) {
        retries.set(
          shareId,
          setTimeout(() => {
            retries.delete(shareId);
            start(shareId, upload, attempt + 1);
          }, UPLOAD_RETRY_DELAYS_MS[attempt])
        );
      }
    });
}

/** Send `upload` now, or after the upload in flight to the same share. */
export function queueShareUpload(shareId: string, upload: ShareUpload): void {
  const queue = queues.get(shareId);
  if (queue) queue.waiting = upload;
  else start(shareId, upload);
}

/**
 * The link holds `upload`'s layout. Nothing that waits is newer, so drop it.
 * But the upload in flight can replace that layout on the link, so `upload`
 * waits for it, and runs if the link took another layout.
 */
export function keepShareLayout(shareId: string, upload: ShareUpload): void {
  cancelRetry(shareId);
  const queue = queues.get(shareId);
  if (queue) queue.waiting = upload;
}

/** Drop what waits for the share: a newer layout replaces it. */
export function dropWaitingUpload(shareId: string): void {
  cancelRetry(shareId);
  const queue = queues.get(shareId);
  if (queue) queue.waiting = null;
}

export function __resetShareUploadsForTests(): void {
  queues.clear();
  for (const timer of retries.values()) clearTimeout(timer);
  retries.clear();
}
