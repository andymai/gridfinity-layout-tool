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
import { useSettingsStore } from '@/core/store/settings';
import type { BaseplateDesignId, StoredBaseplateParams } from '@/core/types';
import {
  updateDesignParams,
  updateDesignThumbnail,
  loadDesign,
  setActiveDesignId,
} from '@/features/baseplate/storage/BaseplateStorage';
import { upsertRegistryEntry } from '@/features/baseplate/store/baseplateRegistry';
import { useBaseplatePageStore } from '@/features/baseplate/store/baseplatePageStore';
import { buildFullParams } from '@/features/baseplate/utils/buildFullParams';
import {
  captureBaseplateThumbnailAtPreset,
  type BaseplateThumbnailFraming,
} from '@/features/baseplate/utils/thumbnail';

const AUTO_SAVE_DELAY_MS = 1000;

/** Cap on how long a save waits for the mesh to settle before capturing. */
const GENERATION_WAIT_MAX_MS = 5000;

/**
 * Resolve the plate framing (grid units + per-side mm padding) the thumbnail
 * capture needs to place its isometric camera. Reads the same layout + settings
 * inputs the generation pipeline uses, so the framing matches what's on screen.
 */
function resolveThumbnailFraming(stored: StoredBaseplateParams): BaseplateThumbnailFraming {
  const { layout } = useLayoutStore.getState();
  const nozzleSizeMm = useSettingsStore.getState().settings.printSettings.nozzleSizeMm;
  const full = buildFullParams(
    stored,
    layout.drawer.width,
    layout.drawer.depth,
    layout.gridUnitMm,
    layout.drawer.fractionalEdgeX ?? 'end',
    layout.drawer.fractionalEdgeY ?? 'end',
    nozzleSizeMm,
    layout.drawer.outline
  );
  return {
    width: full.width,
    depth: full.depth,
    gridUnitMm: full.gridUnitMm,
    paddingLeft: full.paddingLeft,
    paddingRight: full.paddingRight,
    paddingFront: full.paddingFront,
    paddingBack: full.paddingBack,
  };
}

/**
 * Resolve once mesh generation reaches a terminal state (`complete`/`error`) so
 * the thumbnail captures the settled geometry, not a mid-edit draft. `idle` is
 * treated as non-terminal (pre-generation); the timeout captures anyway if the
 * worker is stuck. Bails early via `isCancelled` when the active design changes.
 */
function waitForGenerationSettled(isCancelled: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = (): void => {
      if (isCancelled()) return resolve();
      const status = useBaseplatePageStore.getState().generation.status;
      if (status === 'complete' || status === 'error') return resolve();
      if (Date.now() - start > GENERATION_WAIT_MAX_MS) return resolve();
      setTimeout(check, 150);
    };
    check();
  });
}

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
  // Since a save now awaits generation-settle + a delay, two saves for the same
  // design can overlap. Each save carries a token; scheduling a newer one flips
  // the previous token so the older save bails before its read-modify-write can
  // land stale params/thumbnail (or flash a stale "saved" status). Same shape as
  // the designer's `useAutoSave`.
  const abortTokenRef = useRef<{ current: boolean }>({ current: false });
  // The one-time backfill is likewise superseded by any real edit (its own save
  // captures) — flipped from the save effect so a slow backfill can't overwrite
  // the edit's params with a thumbnail-only write.
  const backfillAbortRef = useRef<{ current: boolean }>({ current: false });

  const performSave = useCallback(
    async (
      paramsToSave: StoredBaseplateParams,
      designId: BaseplateDesignId,
      abortToken: { current: boolean }
    ): Promise<void> => {
      setStatus('saving');

      // Bail when a newer save superseded this one (token flipped) or the active
      // design switched — either way, reporting or persisting this save's
      // outcome would clobber newer data or flash a stale status/thumbnail.
      const superseded = (): boolean =>
        abortToken.current || useLayoutStore.getState().layout.activeBaseplateId !== designId;

      // Wait for the mesh to settle, then let R3F flush the final frame, so the
      // capture reads the finished geometry rather than a ghost wireframe.
      await waitForGenerationSettled(superseded);
      if (superseded()) return;
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (superseded()) return;

      // `null` (capture unavailable — e.g. WebGL context lost) leaves the stored
      // thumbnail untouched rather than clearing it; a data URL replaces it.
      const thumbnail = captureBaseplateThumbnailAtPreset(resolveThumbnailFraming(paramsToSave));
      if (superseded()) return;

      const result = await updateDesignParams(designId, paramsToSave, thumbnail ?? undefined);
      if (superseded()) return;
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

  // Backfill a thumbnail for the active design when it has none yet (e.g. it was
  // created before capture existed, or on a device that never edited it). Runs
  // once per design, silently (no save-status flicker) and only when the stored
  // thumbnail is absent — edits are handled by performSave above. A data URL is
  // ~tens of KB, so this fills the library gradually as designs are opened
  // rather than regenerating every entry up front.
  const thumbnailBackfilledFor = useRef<BaseplateDesignId | null>(null);
  useEffect(() => {
    if (!activeBaseplateId || thumbnailBackfilledFor.current === activeBaseplateId) return;
    const designId = activeBaseplateId;
    thumbnailBackfilledFor.current = designId;

    const token = { current: false };
    backfillAbortRef.current = token;
    const stale = (): boolean =>
      token.current || useLayoutStore.getState().layout.activeBaseplateId !== designId;

    void (async () => {
      const existing = await loadDesign(designId);
      if (stale() || !isOk(existing) || existing.value.thumbnail) return;

      await waitForGenerationSettled(stale);
      if (stale()) return;
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (stale()) return;

      const stored = useLayoutStore.getState().layout.baseplateParams;
      if (!stored) return;
      const thumbnail = captureBaseplateThumbnailAtPreset(resolveThumbnailFraming(stored));
      if (!thumbnail || stale()) return;

      const result = await updateDesignThumbnail(designId, thumbnail);
      if (stale() || !isOk(result)) return;
      upsertRegistryEntry({
        id: result.value.id,
        name: result.value.name,
        updatedAt: result.value.updatedAt,
      });
    })();

    return () => {
      token.current = true;
    };
  }, [activeBaseplateId]);

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

    // This edit is now the authority for the design's params and thumbnail:
    // supersede any in-flight save and the one-time backfill so neither can land
    // a stale write after it.
    abortTokenRef.current.current = true;
    backfillAbortRef.current.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const abortToken = { current: false };
    abortTokenRef.current = abortToken;
    const designId = activeBaseplateId;
    const paramsToSave = params;
    timerRef.current = setTimeout(() => {
      void performSave(paramsToSave, designId, abortToken);
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      abortToken.current = true;
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
