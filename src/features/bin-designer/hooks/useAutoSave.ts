/**
 * Auto-save hook for the Bin Designer.
 *
 * Watches for parameter changes and saves to IndexedDB after a 1-second
 * debounce. Only auto-saves existing designs — new designs require an
 * explicit save (e.g., user renames from "Untitled Bin").
 */

import { useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isOk } from '@/core/result';
import {
  updateDesignParams,
  setActiveDesignId,
} from '@/features/bin-designer/storage/DesignerStorage';
import { useDesignerStore } from '../store';
import { captureThumbnailAtPreset } from '../utils/thumbnail';
import {
  upsertRegistryEntry,
  registryEdgeFields,
  registryHeightFields,
  registryOverhangFields,
  registrySlantFields,
  registryKnifeRestFields,
} from '../store/customBinRegistry';
import { emitSyncEvent } from '@/shared/events/syncEventBus';
import { registerDesignSaveSettler } from './designSaveGate';
import { designId as toDesignId } from '@/core/types';
import type { BinParams, ExportFileNameConfig, GenerationStatus } from '../types';

const AUTO_SAVE_DELAY_MS = 1000;

/**
 * Read abort state through a function call to prevent TypeScript
 * control-flow narrowing across await boundaries.
 */
function isAborted(token: { current: boolean }): boolean {
  return token.current;
}

/**
 * Wait for generation to reach a terminal status (`'complete'` or `'error'`).
 *
 * `'idle'` is excluded — it's the pre-generation state, and treating it as
 * terminal would let autosave capture an empty-canvas thumbnail before the
 * worker has started. The timeout still applies if the worker is stuck.
 *
 * Returns the final status, or null if cancelled via AbortSignal.
 */
function waitForGenerationComplete(
  signal: { current: boolean },
  maxWaitMs = 5000
): Promise<GenerationStatus | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (signal.current) {
        resolve(null);
        return;
      }
      const status = useDesignerStore.getState().generation.status;
      if (status === 'complete' || status === 'error') {
        resolve(status);
        return;
      }
      if (Date.now() - start > maxWaitMs) {
        resolve(status); // Timed out — capture anyway with whatever is rendered
        return;
      }
      setTimeout(check, 200);
    };
    check();
  });
}

/**
 * Automatically saves designer parameters to IndexedDB after a short debounce when they change.
 *
 * Only updates existing designs (where currentDesignId is set). New/unsaved designs are not
 * auto-persisted — the user must explicitly save by naming the design. This prevents unwanted
 * "Untitled Bin" entries from appearing in My Designs during exploratory parameter tweaks.
 */
export function useAutoSave(): void {
  const itemKind = useDesignerStore((s) => s.itemKind);
  const { params, currentDesignId, exportFileNameConfig } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      currentDesignId: s.currentDesignId,
      exportFileNameConfig: s.exportFileNameConfig,
    }))
  );

  const setSaveStatus = useDesignerStore((s) => s.setSaveStatus);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const lastSavedParams = useRef<BinParams | null>(null);
  const lastSavedConfig = useRef<ExportFileNameConfig | null>(null);
  const lastDesignId = useRef<string | null>(null);
  // Bumped whenever another design opens, even the same one reopened: a write
  // finishing in a later session must not vouch for what the editor holds now.
  const session = useRef({ designId: null as string | null, id: 0 });
  const lastSeen = useRef<{
    params: BinParams;
    config: ExportFileNameConfig;
    designId: string;
    session: number;
  } | null>(null);
  const pendingWrites = useRef(new Set<Promise<boolean>>());
  // Abort token for the current pending save (new object per effect run)
  const abortTokenRef = useRef<{ current: boolean }>({ current: false });
  // What a save currently past its abort checks is writing. `lastSaved*` only
  // updates once the write resolves, so without this the unmount flush would
  // re-issue an identical write for a save already in flight.
  const inFlight = useRef<{ params: BinParams; config: ExportFileNameConfig } | null>(null);
  // Read behind a function boundary so a check after an await sees the slot as
  // it is now, not as it was narrowed to at the assignment above the await.
  const isInFlight = (params: BinParams, config: ExportFileNameConfig): boolean => {
    const current = inFlight.current;
    return current !== null && current.params === params && current.config === config;
  };

  // The write itself plus the bookkeeping every consumer downstream depends on
  // (registry entry for the planner palette, `design-saved` for linked bins).
  // Deliberately un-abortable: once we've decided to persist, dropping the
  // registry/event half would leave the layout pointing at a stale design.
  const persist = useCallback(
    (
      paramsToSave: BinParams,
      configToSave: ExportFileNameConfig,
      designId: string,
      thumbnail: string | null | undefined,
      writeSession: number
    ): Promise<boolean> => {
      const write = (async (): Promise<boolean> => {
        inFlight.current = { params: paramsToSave, config: configToSave };
        let result;
        try {
          result = await updateDesignParams(
            toDesignId(designId),
            paramsToSave,
            thumbnail,
            configToSave
          );
        } finally {
          // Only clear if a newer persist hasn't already claimed the slot.
          if (isInFlight(paramsToSave, configToSave)) {
            inFlight.current = null;
          }
        }
        if (!isOk(result)) return false;

        // A write that lands after another design opened, or after this one was
        // reopened from storage, must not vouch for what the editor holds now.
        if (writeSession === session.current.id) {
          lastSavedParams.current = paramsToSave;
          lastSavedConfig.current = configToSave;
          // Track active design for session restoration
          setActiveDesignId(result.value.id);
        }
        // Sync lightweight ref to registry for Layout Planner
        upsertRegistryEntry({
          id: result.value.id,
          name: result.value.name,
          width: paramsToSave.width,
          depth: paramsToSave.depth,
          height: paramsToSave.height,
          ...registryEdgeFields(paramsToSave),
          ...registryHeightFields(paramsToSave),
          ...registryOverhangFields(paramsToSave),
          ...registrySlantFields(paramsToSave),
          ...registryKnifeRestFields(paramsToSave),
          updatedAt: result.value.updatedAt,
        });
        // Notify design-linking to auto-sync linked bins
        emitSyncEvent({
          type: 'design-saved',
          designId: result.value.id,
          dimensions: {
            width: paramsToSave.width,
            depth: paramsToSave.depth,
            height: paramsToSave.height,
          },
        });
        return true;
      })();
      pendingWrites.current.add(write);
      const settled = () => pendingWrites.current.delete(write);
      void write.then(settled, settled);
      return write;
    },
    []
  );

  // No thumbnail: the canvas is gone or already shows another design. Storage
  // keeps the old image marked outdated, so the regeneration hooks redo it.
  const flushUnsaved = useCallback(
    (
      paramsToSave: BinParams,
      configToSave: ExportFileNameConfig,
      designId: string,
      writeSession: number
    ): void => {
      if (lastSavedParams.current === paramsToSave && lastSavedConfig.current === configToSave) {
        return;
      }
      // A save already writing exactly this will land on its own; an in-flight
      // save for older params still needs the flush.
      if (isInFlight(paramsToSave, configToSave)) return;
      void persist(paramsToSave, configToSave, designId, undefined, writeSession);
    },
    [persist]
  );

  const performSave = useCallback(
    async (
      paramsToSave: BinParams,
      configToSave: ExportFileNameConfig,
      designId: string,
      abortToken: { current: boolean },
      writeSession: number
    ): Promise<void> => {
      setSaveStatus('saving');

      // Wait for mesh generation to finish before capturing thumbnail,
      // otherwise we capture ghost wireframes or stale geometry
      await waitForGenerationComplete(abortToken);
      if (isAborted(abortToken)) return;

      // Small delay for React Three Fiber to flush the final render
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (isAborted(abortToken)) return;

      // Capture thumbnail from the standard isometric angle (null if canvas not ready)
      const thumbnail = captureThumbnailAtPreset({
        width: paramsToSave.width,
        depth: paramsToSave.depth,
        height: paramsToSave.height,
        gridUnitMm: paramsToSave.gridUnitMm,
        gridUnitMmY: paramsToSave.gridUnitMmY,
        heightUnitMm: paramsToSave.heightUnitMm,
      });

      const saved = await persist(paramsToSave, configToSave, designId, thumbnail, writeSession);
      setSaveStatus(saved ? 'saved' : 'error');
    },
    [setSaveStatus, persist]
  );

  useEffect(() => {
    if (session.current.designId !== currentDesignId) {
      session.current = { designId: currentDesignId, id: session.current.id + 1 };
    }
    // A switch that skipped settleDesignSaves swaps params and id in one
    // update, so the previous design's unsaved edit survives only in this ref,
    // and the cleanup has already cancelled the save that would have written it.
    const previous = lastSeen.current;
    lastSeen.current =
      itemKind === 'bin' && currentDesignId
        ? {
            params,
            config: exportFileNameConfig,
            designId: currentDesignId,
            session: session.current.id,
          }
        : null;
    if (previous && previous.designId !== currentDesignId) {
      flushUnsaved(previous.params, previous.config, previous.designId, previous.session);
    }

    // Params-only autosave: non-bin kinds persist through their own hooks,
    // and flushing here would write stale bin params onto their rows.
    if (itemKind !== 'bin') return;
    // Skip first render (initial mount shouldn't trigger save)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      lastSavedParams.current = params;
      lastSavedConfig.current = exportFileNameConfig;
      lastDesignId.current = currentDesignId;
      return;
    }

    // When switching designs (loadDesign), reset tracking refs without saving.
    // The loaded design's params are already persisted in IndexedDB.
    if (currentDesignId !== lastDesignId.current) {
      lastDesignId.current = currentDesignId;
      lastSavedParams.current = params;
      lastSavedConfig.current = exportFileNameConfig;
      return;
    }

    // Only auto-save existing designs — new designs require explicit save
    // (e.g., user renames from "Untitled Bin") to avoid creating unwanted entries
    if (!currentDesignId) {
      return;
    }

    // Skip if neither params nor config have changed
    if (lastSavedParams.current === params && lastSavedConfig.current === exportFileNameConfig) {
      return;
    }

    // Abort any in-flight save and clear pending timer
    abortTokenRef.current.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Create a new abort token for this save (separate object per timeout)
    const abortToken = { current: false };
    abortTokenRef.current = abortToken;

    const designId = currentDesignId; // Narrowed to string by guard above
    const writeSession = session.current.id;
    timerRef.current = setTimeout(() => {
      void performSave(params, exportFileNameConfig, designId, abortToken, writeSession);
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      abortToken.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [itemKind, params, exportFileNameConfig, currentDesignId, performSave, flushUnsaved]);

  // Leaving the designer (route change) unmounts this hook, which aborts both
  // the debounce and any save still waiting on generation — a window of up to
  // ~6s in which the user's last edits were silently dropped while the
  // in-memory store kept showing them. Flush straight to storage instead.
  useEffect(() => {
    return () => {
      const state = useDesignerStore.getState();
      const id = state.currentDesignId;
      if (!id || state.itemKind !== 'bin') return;
      flushUnsaved(state.params, state.exportFileNameConfig, id, session.current.id);
    };
  }, [flushUnsaved]);

  useEffect(
    () =>
      registerDesignSaveSettler(async () => {
        const state = useDesignerStore.getState();
        const id = state.currentDesignId;
        if (id && state.itemKind === 'bin') {
          flushUnsaved(state.params, state.exportFileNameConfig, id, session.current.id);
        }
        await Promise.allSettled([...pendingWrites.current]);
      }),
    [flushUnsaved]
  );
}
