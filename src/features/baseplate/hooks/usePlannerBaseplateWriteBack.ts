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
import type { BaseplateDesignId, StoredBaseplateParams } from '@/core/types';
import { loadDesign, updateDesignParams } from '../storage/BaseplateStorage';
import { upsertRegistryEntry } from '../store/baseplateRegistry';
import { paramsEqual } from '../utils/paramsEqual';

/** The page autosave's delay. A run of undos writes once. */
const WRITE_DELAY_MS = 1000;

interface PendingWrite {
  readonly designId: BaseplateDesignId;
  readonly params: StoredBaseplateParams;
  /** Order of the edit, so an older write never lands over a newer one. */
  readonly seq: number;
}

/** Resolves false when storage failed, so the edit can try again. */
async function writeIfChanged({ designId, params }: PendingWrite): Promise<boolean> {
  const stored = await loadDesign(designId);
  if (!isOk(stored)) return false;
  // A restore that leaves the plate as saved writes nothing, so an undo of a
  // bin edit does not touch the design or its sync stamp.
  if (paramsEqual(stored.value.params, params)) return true;
  const updated = await updateDesignParams(designId, params);
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
    // Writes run one at a time, in the order they were flushed.
    let queue: Promise<void> = Promise.resolve();

    const isNewest = (write: PendingWrite): boolean => newest.get(write.designId) === write.seq;

    const run = (write: PendingWrite): void => {
      queue = queue.then(async () => {
        if (!isNewest(write)) return;
        if (!(await writeIfChanged(write)) && isNewest(write)) failed.set(write.designId, write);
      });
    };

    /** Write the pending edit, and try again the ones storage refused. */
    const flush = (): void => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      const retries = [...failed.values()];
      failed.clear();
      for (const write of retries) run(write);
      const write = pending;
      pending = null;
      if (write !== null) run(write);
    };

    const schedule = (): void => {
      const { activeBaseplateId, baseplateParams } = useLayoutStore.getState().layout;
      if (!activeBaseplateId || !baseplateParams) return;
      if (pending !== null && pending.designId !== activeBaseplateId) flush();
      seq += 1;
      newest.set(activeBaseplateId, seq);
      failed.delete(activeBaseplateId);
      pending = { designId: activeBaseplateId, params: baseplateParams, seq };
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, WRITE_DELAY_MS);
    };

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') flush();
    };

    const unsubscribers = [
      eventBus.subscribe('layout.baseplateParamsSet', schedule),
      eventBus.subscribe('layout.restored', schedule),
    ];
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flush();
    };
  }, []);
}
