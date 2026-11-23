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
}

async function writeIfChanged({ designId, params }: PendingWrite): Promise<void> {
  const stored = await loadDesign(designId);
  // A restore that leaves the plate as saved writes nothing, so an undo of a
  // bin edit does not touch the design or its sync stamp.
  if (!isOk(stored) || paramsEqual(stored.value.params, params)) return;
  const updated = await updateDesignParams(designId, params);
  if (!isOk(updated)) return;
  upsertRegistryEntry({
    id: updated.value.id,
    name: updated.value.name,
    updatedAt: updated.value.updatedAt,
  });
}

export function usePlannerBaseplateWriteBack(): void {
  useEffect(() => {
    let pending: PendingWrite | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Writes run in order, so a slow earlier write never lands after a later one.
    let queue: Promise<void> = Promise.resolve();

    const flush = (): void => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      const write = pending;
      pending = null;
      if (write !== null) queue = queue.then(() => writeIfChanged(write));
    };

    const schedule = (): void => {
      const { activeBaseplateId, baseplateParams } = useLayoutStore.getState().layout;
      if (!activeBaseplateId || !baseplateParams) return;
      if (pending !== null && pending.designId !== activeBaseplateId) flush();
      pending = { designId: activeBaseplateId, params: baseplateParams };
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
