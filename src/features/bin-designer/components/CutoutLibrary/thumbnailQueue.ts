/**
 * Library thumbnails made one at a time on this device, newest request first.
 * Each render builds a whole bin in the generation worker, so a library opened
 * with fifty items must not start fifty builds at once.
 *
 * An item pulled from another device can show before its mesh files arrive.
 * Its render waits for them: a picture made without the imprint would be kept
 * for that version of the item and never redrawn.
 *
 * Renders share the generation bridge with the editor, and a new request there
 * cancels the one before it, so each render waits for the editor to be idle.
 */

import type { CutoutLibraryItem } from '@/features/bin-designer/library/libraryTypes';
import { getThumbnail, putThumbnail } from '@/features/bin-designer/library/CutoutLibraryService';
import { regenerateThumbnail } from '@/features/bin-designer/utils/thumbnailRegenerator';
import { holderMeshHashes } from '@/shared/generation/meshRefs';
import { hasMeshFile, subscribeMeshFileArrivals } from '@/shared/generation/meshStore';
import { editorBuilding, untilEditorIdle } from '@/features/bin-designer/utils/editorIdle';
import { thumbnailHost } from './thumbnailHost';

type Listener = (dataUrl: string) => void;

interface Job {
  readonly item: CutoutLibraryItem;
  readonly listeners: Set<Listener>;
}

const pending = new Map<string, Job>();
/** Jobs whose mesh files are not on this device yet. */
const waiting = new Map<string, Job>();
/** The job being processed, so a request for the same item joins it. */
let active: { readonly key: string; readonly job: Job } | null = null;
let running = false;
let stopArrivals: (() => void) | null = null;

const keyOf = (item: CutoutLibraryItem) => `${item.id}@${item.updatedAt}`;

async function meshesHere(item: CutoutLibraryItem): Promise<boolean> {
  for (const hash of holderMeshHashes(item.content)) {
    if (!(await hasMeshFile(hash))) return false;
  }
  return true;
}

function wait(key: string, job: Job): void {
  const existing = waiting.get(key);
  if (existing) {
    for (const listener of job.listeners) existing.listeners.add(listener);
  } else {
    waiting.set(key, job);
  }
  stopArrivals ??= subscribeMeshFileArrivals(() => {
    for (const [k, j] of waiting) pending.set(k, j);
    waiting.clear();
    void drain();
  });
}

async function drain(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (let next = [...pending.entries()].at(-1); next; next = [...pending.entries()].at(-1)) {
      const [key, job] = next;
      pending.delete(key);
      active = { key, job };
      try {
        if (!(await meshesHere(job.item))) {
          wait(key, job);
          continue;
        }
        const idle = await untilEditorIdle();
        // Every row that asked may have gone while the editor was busy.
        if (job.listeners.size === 0) continue;
        if (!idle) {
          pending.set(key, job);
          continue;
        }
        const host = thumbnailHost(job.item.content);
        const dataUrl = host ? await regenerateThumbnail(host) : null;
        if (!dataUrl) {
          // An editor build that started meanwhile cancelled this render.
          if (editorBuilding() && job.listeners.size > 0) pending.set(key, job);
          continue;
        }
        if (job.listeners.size === 0) continue;
        await putThumbnail(job.item, dataUrl);
        for (const listener of job.listeners) listener(dataUrl);
      } finally {
        active = null;
      }
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
    const current = active?.key === key ? active.job : undefined;
    const job = pending.get(key) ??
      waiting.get(key) ??
      current ?? { item, listeners: new Set<Listener>() };
    job.listeners.add(listener);
    if (waiting.has(key) || job === current) return;
    // Re-inserted so the item asked for last is drawn first.
    pending.delete(key);
    pending.set(key, job);
    void drain();
  });
  return () => {
    cancelled = true;
    if (active?.key === key) active.job.listeners.delete(listener);
    for (const queue of [pending, waiting]) {
      const job = queue.get(key);
      if (!job) continue;
      job.listeners.delete(listener);
      if (job.listeners.size === 0) queue.delete(key);
    }
  };
}
