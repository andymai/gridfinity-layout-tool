/**
 * Auto-save hook for the active baseplate library design.
 *
 * When a layout has an `activeBaseplateId`, edits to `layout.baseplateParams`
 * are debounced (1s) and written back into the shared library design — keeping
 * the library entry (the source of truth) in sync with the materialized copy.
 * Only autosaves designs that already have an id; detached inline drafts
 * (activeBaseplateId === null) stay unsaved until an explicit Save.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isOk } from '@/core/result';
import { useLayoutStore } from '@/core/store/layout';
import type { BaseplateDesignId, StoredBaseplateParams } from '@/core/types';
import {
  updateDesignParams,
  setActiveDesignId,
} from '@/features/baseplate/storage/BaseplateStorage';
import { upsertRegistryEntry } from '@/features/baseplate/store/baseplateRegistry';

const AUTO_SAVE_DELAY_MS = 1000;

export function useBaseplateAutoSave(): void {
  const { params, activeBaseplateId } = useLayoutStore(
    useShallow((s) => ({
      params: s.layout.baseplateParams,
      activeBaseplateId: s.layout.activeBaseplateId ?? null,
    }))
  );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const lastSavedParams = useRef<StoredBaseplateParams | undefined>(undefined);
  const lastActiveId = useRef<BaseplateDesignId | null>(null);

  const performSave = useCallback(
    async (paramsToSave: StoredBaseplateParams, designId: BaseplateDesignId): Promise<void> => {
      // TODO(Phase 1 follow-up): capture a baseplate preview thumbnail here once
      // an offscreen capture util exists (BaseplatePreview has none today). Until
      // then the thumbnail is left unchanged.
      const result = await updateDesignParams(designId, paramsToSave);
      if (isOk(result)) {
        lastSavedParams.current = paramsToSave;
        setActiveDesignId(result.value.id);
        upsertRegistryEntry({
          id: result.value.id,
          name: result.value.name,
          updatedAt: result.value.updatedAt,
        });
      }
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

    // Only autosave saved designs (drafts have no id).
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
}
