/**
 * Auto-save hook for the active baseplate library design.
 *
 * Edits to `layout.baseplateParams` are debounced (1s) and written back into
 * the shared library design — keeping the library entry (the source of truth)
 * in sync with the materialized copy.
 *
 * `useBaseplateInit` guarantees an active design exists, so there is no
 * unsaved-draft branch here: if `activeBaseplateId` is momentarily null we are
 * mid-init and simply skip until it lands.
 *
 * Returns the save status for the header indicator, mirroring the designer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isOk } from '@/core/result';
import type { SaveStatus } from '@/shared/types/saveStatus';
import { useLayoutStore } from '@/core/store/layout';
import type { BaseplateDesignId, StoredBaseplateParams } from '@/core/types';
import {
  updateDesignParams,
  setActiveDesignId,
} from '@/features/baseplate/storage/BaseplateStorage';
import { upsertRegistryEntry } from '@/features/baseplate/store/baseplateRegistry';

const AUTO_SAVE_DELAY_MS = 1000;

export function useBaseplateAutoSave(): SaveStatus {
  const { params, activeBaseplateId } = useLayoutStore(
    useShallow((s) => ({
      params: s.layout.baseplateParams,
      activeBaseplateId: s.layout.activeBaseplateId ?? null,
    }))
  );

  // Tracks an actual save attempt only. The resting "already persisted" state
  // is derived on return, so nothing sets state inside the effect (which would
  // cascade a second render).
  const [status, setStatus] = useState<SaveStatus>('idle');
  // Reset the attempt when the active design changes, so an error from the
  // previous design can't stick to the next one. Adjusting state during render
  // rather than in an effect, per the React docs — same pattern as
  // DeferredNumberInput.
  const [lastStatusId, setLastStatusId] = useState(activeBaseplateId);
  if (activeBaseplateId !== lastStatusId) {
    setLastStatusId(activeBaseplateId);
    setStatus('idle');
  }
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const lastSavedParams = useRef<StoredBaseplateParams | undefined>(undefined);
  const lastActiveId = useRef<BaseplateDesignId | null>(null);

  const performSave = useCallback(
    async (paramsToSave: StoredBaseplateParams, designId: BaseplateDesignId): Promise<void> => {
      // TODO(Phase 1 follow-up): capture a baseplate preview thumbnail here once
      // an offscreen capture util exists (BaseplatePreview has none today). Until
      // then the thumbnail is left unchanged.
      setStatus('saving');
      const result = await updateDesignParams(designId, paramsToSave);
      // The active design can switch while IndexedDB awaits. Reporting this
      // save's outcome now would flash a status belonging to the old design.
      if (useLayoutStore.getState().layout.activeBaseplateId !== designId) return;
      if (!isOk(result)) {
        // Surfaced in the header rather than swallowed — the edit is still in
        // the layout, but it is no longer in the library.
        setStatus('error');
        return;
      }
      lastSavedParams.current = paramsToSave;
      setActiveDesignId(result.value.id);
      upsertRegistryEntry({
        id: result.value.id,
        name: result.value.name,
        updatedAt: result.value.updatedAt,
      });
      setStatus('saved');
    },
    []
  );

  useEffect(() => {
    // Skip first render (initial mount shouldn't trigger save)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      lastSavedParams.current = params;
      lastActiveId.current = activeBaseplateId;
      return;
    }

    // When switching active design, reset tracking without saving — the newly
    // active design's params are already persisted in the library.
    if (activeBaseplateId !== lastActiveId.current) {
      lastActiveId.current = activeBaseplateId;
      lastSavedParams.current = params;
      return;
    }

    // Mid-init: useBaseplateInit is about to point the layout at a design.
    if (!activeBaseplateId || !params) {
      return;
    }

    // Skip if params have not changed.
    if (lastSavedParams.current === params) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const designId = activeBaseplateId;
    const paramsToSave = params;
    timerRef.current = setTimeout(() => {
      void performSave(paramsToSave, designId);
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [params, activeBaseplateId, performSave]);

  // An active design with no save in flight is, by definition, saved: its
  // params came out of the library. Mirrors the designer, which marks a loaded
  // design 'saved' rather than leaving the indicator blank until the first edit.
  if (status === 'idle' && activeBaseplateId) return 'saved';
  return status;
}
