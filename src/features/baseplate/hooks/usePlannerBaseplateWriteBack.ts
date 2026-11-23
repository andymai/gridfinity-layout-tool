/**
 * Writes the plate params to the active saved design after a plate edit on the
 * planner: the drawer fit suggestion, or an undo or redo that changes the plate.
 * On /baseplate, `useBaseplateAutoSave` does this with the thumbnail and the
 * save status. Without the write, the next load puts the saved design's older
 * params back over the edit (`useBaseplateLibraryInit`).
 *
 * Only these events start a write. A layout load, a sync pull and the init's
 * own restore from the saved design change the params too, and writing those
 * back would make the layout's copy the source of truth.
 */

import { useEffect } from 'react';
import { eventBus } from '@/core/cqrs';
import { isOk } from '@/core/result';
import { useLayoutStore } from '@/core/store/layout';
import type { BaseplateDesignId, LayoutId, StoredBaseplateParams } from '@/core/types';
import { updateDesignParamsIfChanged } from '../storage/BaseplateStorage';
import { upsertRegistryEntry } from '../store/baseplateRegistry';
import { onBaseplateSplit } from '../store/baseplateSplits';

/** The page autosave's delay. A run of undos writes once. */
const WRITE_DELAY_MS = 1000;

interface PendingWrite {
  readonly layoutId: LayoutId | null;
  readonly designId: BaseplateDesignId;
  readonly params: StoredBaseplateParams;
  /** Order of the edit, so an older write never lands over a newer one. */
  readonly seq: number;
}

/**
 * Resolves false when storage failed, so the edit can try again. Storage orders
 * this write with the page autosave's, and skips it when the design already
 * holds the params, so an undo of a bin edit leaves the design's sync stamp.
 */
async function writeIfChanged({ designId, params }: PendingWrite): Promise<boolean> {
  const updated = await updateDesignParamsIfChanged(designId, params);
  if (!isOk(updated)) return false;
  upsertRegistryEntry({
    id: updated.value.id,
    name: updated.value.name,
    updatedAt: updated.value.updatedAt,
  });
  return true;
}

export function usePlannerBaseplateWriteBack(): void {
  useEffect(() => {
    let pending: PendingWrite | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let seq = 0;
    /** The newest edit for each design. Only that edit may write or retry. */
    const newest = new Map<BaseplateDesignId, number>();
    /** Newest edits that storage refused, kept for the next flush. */
    const failed = new Map<BaseplateDesignId, PendingWrite>();
    /**
     * For a layout that the init split off a shared design, the newest edit it
     * made to that design. Those edits belong to the layout's own copy now, so
     * they must not reach the shared design. A later edit to it still writes.
     */
    const splitUpTo = new Map<string, number>();
    const splitKey = (layout: LayoutId | null, design: BaseplateDesignId): string =>
      `${layout ?? ''}|${design}`;
    const splitAway = (write: PendingWrite): boolean =>
      (splitUpTo.get(splitKey(write.layoutId, write.designId)) ?? 0) >= write.seq;
    // Writes run one at a time, in the order they were flushed.
    let queue: Promise<void> = Promise.resolve();

    const isNewest = (write: PendingWrite): boolean => newest.get(write.designId) === write.seq;

    const run = (write: PendingWrite): void => {
      queue = queue.then(async () => {
        if (!isNewest(write) || splitAway(write)) return;
        if (!(await writeIfChanged(write)) && isNewest(write) && !splitAway(write)) {
          failed.set(write.designId, write);
        }
      });
    };

    /**
     * Write the pending edit to the design it was made on, and try again the
     * ones storage refused. A design switch, or an undo that changes the
     * design, flushes first, so each edit reaches its own design.
     */
    const flush = (): void => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      const writes = [...failed.values()];
      failed.clear();
      if (pending !== null) writes.push(pending);
      pending = null;
      for (const write of writes) if (!splitAway(write)) run(write);
    };

    const schedule = (): void => {
      const { activeLayoutId, layout } = useLayoutStore.getState();
      const { activeBaseplateId, baseplateParams } = layout;
      if (!activeBaseplateId || !baseplateParams) return;
      if (pending !== null && pending.designId !== activeBaseplateId) flush();
      seq += 1;
      newest.set(activeBaseplateId, seq);
      failed.delete(activeBaseplateId);
      pending = {
        layoutId: activeLayoutId,
        designId: activeBaseplateId,
        params: baseplateParams,
        seq,
      };
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => flush(), WRITE_DELAY_MS);
    };

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') flush();
    };

    const unsubscribers = [
      eventBus.subscribe('layout.baseplateParamsSet', schedule),
      eventBus.subscribe('layout.restored', schedule),
      eventBus.subscribe('layout.activeBaseplateSet', () => flush()),
      onBaseplateSplit((layout, design) => {
        splitUpTo.set(splitKey(layout, design), seq);
      }),
    ];
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flush();
    };
  }, []);
}
