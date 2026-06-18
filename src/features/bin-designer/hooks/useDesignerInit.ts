/**
 * Designer initialization hook.
 *
 * Ensures the designer always has an active design.
 * Similar to how the grid editor's initializeLayoutLibrary() works,
 * but async since we use IndexedDB.
 *
 * Flow:
 * 1. If URL has ?id=, let useDesignerUrlSync handle loading
 * 2. If URL has ?createFrom=bin, let useCreateFromBin handle it
 * 3. If no URL param and no currentDesignId, initialize:
 *    - Try to load previously active design from storage
 *    - If not found, create a new "Untitled Bin" design
 * 4. Set currentDesignId so auto-save works immediately
 *
 * Also handles when newDesign() is called (sets currentDesignId to null):
 * - Creates a new design immediately to keep auto-save working
 */

import { useEffect, useRef } from 'react';
import { isOk } from '@/core/result';
import type { DesignId } from '@/core/types';
import {
  initializeDesigner,
  createNewDesign,
  setActiveDesignId,
} from '@/features/bin-designer/storage/DesignerStorage';
import { useDesignerStore } from '../store';
import { useDesignerRouting } from '@/shared/hooks/useDesignerRouting';
import { upsertRegistryEntry } from '../store/customBinRegistry';
import { isBinDesign } from '../utils/designKind';

/**
 * Check if URL has createFrom=bin params (handled by useCreateFromBin).
 */
function hasCreateFromBinParams(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('createFrom') === 'bin';
}

/**
 * Initialize the designer with an active design.
 *
 * Must be called before useAutoSave to ensure currentDesignId is set.
 * Skips initialization if URL contains a design ID (defers to useDesignerUrlSync)
 * or createFrom=bin params (defers to useCreateFromBin).
 */
export function useDesignerInit(): void {
  const { designIdFromUrl } = useDesignerRouting();
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  const pendingBinLink = useDesignerStore((s) => s.pendingBinLink);
  const loadDesign = useDesignerStore((s) => s.loadDesign);
  const setCurrentDesignId = useDesignerStore((s) => s.setCurrentDesignId);

  // Track if this is the first time currentDesignId became null
  // (vs. being null on mount which needs full initialization)
  const hasInitialized = useRef(false);
  const initInProgress = useRef(false);

  useEffect(() => {
    // Skip if URL has a design ID - useDesignerUrlSync will handle it
    if (designIdFromUrl) {
      hasInitialized.current = true;
      return;
    }

    // Skip if URL has createFrom=bin params - useCreateFromBin will handle it
    if (hasCreateFromBinParams()) {
      hasInitialized.current = true;
      return;
    }

    // Skip if useCreateFromBin already set up the design (pendingBinLink is set)
    if (pendingBinLink) {
      hasInitialized.current = true;
      return;
    }

    // Skip if we already have a design loaded
    if (currentDesignId) {
      hasInitialized.current = true;
      return;
    }

    // Prevent concurrent initialization
    if (initInProgress.current) return;
    initInProgress.current = true;

    const doInit = async () => {
      // Double-check URL params haven't been processed while we were waiting
      // (useCreateFromBin may have run and set pendingBinLink)
      const state = useDesignerStore.getState();
      if (state.pendingBinLink || state.currentDesignId) {
        hasInitialized.current = true;
        initInProgress.current = false;
        return;
      }

      if (!hasInitialized.current) {
        // First load - try to restore previous session or create new
        const result = await initializeDesigner();
        if (isOk(result)) {
          const design = result.value;
          loadDesign(design);
          setActiveDesignId(design.id);
          if (isBinDesign(design)) syncToRegistry(design);
        }
      } else {
        // newDesign() was called - create a fresh design
        const result = await createNewDesign();
        if (isOk(result)) {
          const design = result.value;
          // Only set the ID, params are already reset by newDesign()
          setCurrentDesignId(design.id);
          setActiveDesignId(design.id);
          if (isBinDesign(design)) syncToRegistry(design);
        }
      }
      hasInitialized.current = true;
      initInProgress.current = false;
    };

    void doInit();
  }, [designIdFromUrl, currentDesignId, pendingBinLink, loadDesign, setCurrentDesignId]);
}

function syncToRegistry(design: {
  id: DesignId;
  name: string;
  params: { width: number; depth: number; height: number };
  updatedAt: string;
}): void {
  upsertRegistryEntry({
    id: design.id,
    name: design.name,
    width: design.params.width,
    depth: design.params.depth,
    height: design.params.height,
    updatedAt: design.updatedAt,
  });
}
