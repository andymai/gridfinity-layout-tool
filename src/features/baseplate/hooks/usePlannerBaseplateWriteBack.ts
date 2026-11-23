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

export function usePlannerBaseplateWriteBack(): void {
  useEffect(() => {
    let pending: PendingWrite | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let seq = 0;
    // Keyed by layout and design: two layouts can edit one shared design, and
    // a split takes over only the edits of the layout it split.
    const keyOf = (layout: LayoutId | null, design: BaseplateDesignId): string =>
      `${layout ?? ''}|${design}`;
    const writeKey = (write: PendingWrite): string => keyOf(write.layoutId, write.designId);
    /** The newest edit for each layout and design. Only that edit may write or retry. */
    const newest = new Map<string, number>();
    /** Newest edits that storage refused, kept for the next flush. */
    const failed = new Map<string, PendingWrite>();
    /**
     * For a layout that the init split off a shared design, the newest edit it
     * made to that design. Those edits belong to the layout's own copy now, so
     * they must not reach the shared design. A later edit to it still writes.
     */
    const splitUpTo = new Map<string, number>();
    /**
     * The newest edit that reached each design, from any layout. An older edit
     * retried after it, from another layout, would put older params back.
     */
    const landed = new Map<BaseplateDesignId, number>();

    const stillWanted = (write: PendingWrite): boolean =>
      newest.get(writeKey(write)) === write.seq &&
      (splitUpTo.get(writeKey(write)) ?? 0) < write.seq &&
      (landed.get(write.designId) ?? 0) < write.seq;

    /**
     * Storage orders writes per design and asks `stillWanted` when this one's
     * turn comes, so a split or a newer edit made while it waits calls it off.
     * It skips a write the design already holds, so an undo of a bin edit
     * leaves the design's sync stamp.
     */
    const submit = async (write: PendingWrite): Promise<void> => {
      const turn = { wanted: false };
      const updated = await updateDesignParamsIfChanged(write.designId, write.params, () => {
        turn.wanted = stillWanted(write);
        return turn.wanted;
      });
      if (isOk(updated)) {
        // Only an edit storage wrote, or found already there, counts as landed.
        if (turn.wanted) landed.set(write.designId, write.seq);
        upsertRegistryEntry({
          id: updated.value.id,
          name: updated.value.name,
          updatedAt: updated.value.updatedAt,
        });
      } else if (stillWanted(write)) {
        failed.set(writeKey(write), write);
      }
    };

    /**
     * Write the pending edit to the design the user edited, and try again the
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
      for (const write of writes) if (stillWanted(write)) void submit(write);
    };

    const schedule = (): void => {
      const { activeLayoutId, layout } = useLayoutStore.getState();
      const { activeBaseplateId, baseplateParams } = layout;
      if (!activeBaseplateId || !baseplateParams) return;
      if (
        pending !== null &&
        (pending.designId !== activeBaseplateId || pending.layoutId !== activeLayoutId)
      ) {
        flush();
      }
      seq += 1;
      const write: PendingWrite = {
        layoutId: activeLayoutId,
        designId: activeBaseplateId,
        params: baseplateParams,
        seq,
      };
      newest.set(writeKey(write), seq);
      failed.delete(writeKey(write));
      pending = write;
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
        splitUpTo.set(keyOf(layout, design), seq);
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
