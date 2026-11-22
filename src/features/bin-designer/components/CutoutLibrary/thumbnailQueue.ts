/**
 * Library thumbnails made one at a time on this device, newest request first.
 * Each render builds a whole bin in the generation worker, so a library opened
 * with fifty items must not start fifty builds at once.
 */

import type { CutoutLibraryItem } from '@/features/bin-designer/library/libraryTypes';
import { getThumbnail, putThumbnail } from '@/features/bin-designer/library/CutoutLibraryService';
import { regenerateThumbnail } from '@/features/bin-designer/utils/thumbnailRegenerator';
import { thumbnailHost } from './thumbnailHost';

type Listener = (dataUrl: string) => void;

interface Pending {
  item: CutoutLibraryItem;
  readonly listeners: Set<Listener>;
}

const pending = new Map<string, Pending>();
let running = false;

const keyOf = (item: CutoutLibraryItem) => `${item.id}@${item.updatedAt}`;

async function drain(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (let next = [...pending.values()].at(-1); next; next = [...pending.values()].at(-1)) {
      const key = keyOf(next.item);
      const host = thumbnailHost(next.item.content);
      const dataUrl = host ? await regenerateThumbnail(host) : null;
      const job = pending.get(key);
      pending.delete(key);
      if (!dataUrl || !job) continue;
      await putThumbnail(job.item, dataUrl);
      for (const listener of job.listeners) listener(dataUrl);
    }
  } finally {
    running = false;
  }
}

/**
 * The item's thumbnail: at once from the store when one exists for this
 * version of it, otherwise when the queue reaches it. Returns a cancel that
 * drops the listener, and the job once nothing waits for it.
 */
export function requestThumbnail(item: CutoutLibraryItem, onReady: Listener): () => void {
  const key = keyOf(item);
  let cancelled = false;
  const listener: Listener = (url) => {
    if (!cancelled) onReady(url);
  };
  void getThumbnail(item).then((stored) => {
    if (cancelled) return;
    if (stored) {
      onReady(stored);
      return;
    }
    const job = pending.get(key) ?? { item, listeners: new Set<Listener>() };
    job.listeners.add(listener);
    // Re-inserted so the item asked for last is drawn first.
    pending.delete(key);
    pending.set(key, job);
    void drain();
  });
  return () => {
    cancelled = true;
    const job = pending.get(key);
    if (!job) return;
    job.listeners.delete(listener);
    if (job.listeners.size === 0) pending.delete(key);
  };
}
