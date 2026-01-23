/**
 * Auto-save hook for the Bin Designer.
 *
 * Watches for parameter changes and saves to IndexedDB after a 1-second
 * debounce. Creates a new design on first save, updates existing on subsequent.
 */

import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isOk } from '@/core/result';
import { saveDesign, updateDesignParams } from '@/core/storage/DesignerStorage';
import { useDesignerStore } from '../store';
import { captureThumbnail } from '../utils/thumbnail';
import { upsertRegistryEntry } from '../store/customBinRegistry';
import type { BinParams } from '../types';

const AUTO_SAVE_DELAY_MS = 1000;

/**
 * Automatically saves designer parameters to IndexedDB after a short debounce when they change.
 *
 * Watches the designer's parameters and, after 1000ms of inactivity, either updates the current design or creates a new one; captures a 3D-preview thumbnail if available, updates a lightweight registry entry with design metadata, and updates save status and current design id as appropriate. Skips saving on initial mount and avoids redundant saves when parameters are unchanged.
 */
export function useAutoSave(): void {
  const { params, currentDesignId, designName } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      currentDesignId: s.currentDesignId,
      designName: s.designName,
    }))
  );

  const setSaveStatus = useDesignerStore((s) => s.setSaveStatus);
  const setCurrentDesignId = useDesignerStore((s) => s.setCurrentDesignId);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const lastSavedParams = useRef<BinParams | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    // Skip first render (initial mount shouldn't trigger save)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      lastSavedParams.current = params;
      return;
    }

    // Skip if params haven't actually changed (reference check is fine with Immer)
    if (lastSavedParams.current === params) {
      return;
    }

    // Abort any in-flight save and clear pending timer
    abortRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Reset abort flag for the new save
    abortRef.current = false;
    const abortToken = abortRef;

    timerRef.current = setTimeout(() => {
      void performSave(params, currentDesignId, designName, abortToken);
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      abortRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [params, currentDesignId, designName]);

  async function performSave(
    paramsToSave: BinParams,
    designId: string | null,
    name: string,
    abortToken: { current: boolean }
  ): Promise<void> {
    setSaveStatus('saving');

    // Capture thumbnail from the 3D preview (null if canvas not ready)
    const thumbnail = captureThumbnail();

    if (designId) {
      // Update existing design
      const result = await updateDesignParams(designId, paramsToSave, thumbnail);
      if (abortToken.current) return; // Superseded by newer save
      if (isOk(result)) {
        lastSavedParams.current = paramsToSave;
        setSaveStatus('saved');
        // Sync lightweight ref to registry for Layout Planner
        upsertRegistryEntry({
          id: result.value.id,
          name: result.value.name,
          width: paramsToSave.width,
          depth: paramsToSave.depth,
          height: paramsToSave.height,
          thumbnail: result.value.thumbnail,
          updatedAt: result.value.updatedAt,
        });
      } else {
        setSaveStatus('error');
      }
    } else {
      // Create new design
      const result = await saveDesign({
        name,
        params: paramsToSave,
        thumbnail,
      });
      if (abortToken.current) return; // Superseded by newer save
      if (isOk(result)) {
        lastSavedParams.current = paramsToSave;
        setCurrentDesignId(result.value.id);
        setSaveStatus('saved');
        // Sync lightweight ref to registry for Layout Planner
        upsertRegistryEntry({
          id: result.value.id,
          name: result.value.name,
          width: paramsToSave.width,
          depth: paramsToSave.depth,
          height: paramsToSave.height,
          thumbnail: result.value.thumbnail,
          updatedAt: result.value.updatedAt,
        });
      } else {
        setSaveStatus('error');
      }
    }
  }
}