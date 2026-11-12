/**
 * Uploads from this tab to each share, one at a time. Both uploaders (a
 * collab room's and the owner's local one) go through here, and so does a
 * room that the owner left or opened again. A request that comes while an
 * upload runs waits, and a later request replaces it, so an older layout
 * never lands after a newer one from this tab.
 */
export interface ShareUpload {
  /** The layout that the upload saves. Equal keys save equal layouts. */
  readonly key: string;
  /** Resolves true when the link took the layout. */
  readonly run: () => Promise<boolean>;
}

interface ShareQueue {
  inFlight: string;
  waiting: ShareUpload | null;
}

const queues = new Map<string, ShareQueue>();

function start(shareId: string, upload: ShareUpload): void {
  const queue: ShareQueue = { inFlight: upload.key, waiting: null };
  queues.set(shareId, queue);
  void upload
    .run()
    .catch(() => false)
    .then((saved) => {
      if (queues.get(shareId) !== queue) return;
      queues.delete(shareId);
      const next = queue.waiting;
      // The link already holds what waits.
      if (!next || (saved && next.key === queue.inFlight)) return;
      start(shareId, next);
    });
}

/** Run `upload` now, or after the upload in flight to the same share. */
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
  const queue = queues.get(shareId);
  if (queue) queue.waiting = upload;
}

/** Drop what waits for the share: a newer layout replaces it. */
export function dropWaitingUpload(shareId: string): void {
  const queue = queues.get(shareId);
  if (queue) queue.waiting = null;
}

export function __resetShareUploadsForTests(): void {
  queues.clear();
}
