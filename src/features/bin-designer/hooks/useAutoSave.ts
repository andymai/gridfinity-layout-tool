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
import { upsertRegistryEntry } from '../store/customBinRegistry';
import { emitSyncEvent } from '@/shared/events/syncEventBus';
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
 * Wait for generation to reach 'complete' or 'error' status.
 * Polls the store at 200ms intervals up to a maximum wait time.
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
      if (status === 'complete' || status === 'error' || status === 'idle') {
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
  // Abort token for the current pending save (new object per effect run)
  const abortTokenRef = useRef<{ current: boolean }>({ current: false });

  const performSave = useCallback(
    async (
      paramsToSave: BinParams,
      configToSave: ExportFileNameConfig,
      designId: string,
      abortToken: { current: boolean }
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
      });

      const result = await updateDesignParams(
        toDesignId(designId),
        paramsToSave,
        thumbnail,
        configToSave
      );
      if (abortToken.current) return; // Superseded by newer save
      if (isOk(result)) {
        lastSavedParams.current = paramsToSave;
        lastSavedConfig.current = configToSave;
        setSaveStatus('saved');
        // Track active design for session restoration
        setActiveDesignId(result.value.id);
        // Sync lightweight ref to registry for Layout Planner
        upsertRegistryEntry({
          id: result.value.id,
          name: result.value.name,
          width: paramsToSave.width,
          depth: paramsToSave.depth,
          height: paramsToSave.height,
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
      } else {
        setSaveStatus('error');
      }
    },
    [setSaveStatus]
  );

  useEffect(() => {
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
    timerRef.current = setTimeout(() => {
      void performSave(params, exportFileNameConfig, designId, abortToken);
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      abortToken.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [params, exportFileNameConfig, currentDesignId, performSave]);
}
