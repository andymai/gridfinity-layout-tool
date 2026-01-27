/**
 * Designer initialization hook.
 *
 * Ensures the designer always has an active design.
 * Similar to how the grid editor's initializeLayoutLibrary() works,
 * but async since we use IndexedDB.
 *
 * Flow:
 * 1. If URL has ?id=, let useDesignerUrlSync handle loading
 * 2. If no URL param and no currentDesignId, initialize:
 *    - Try to load previously active design from storage
 *    - If not found, create a new "Untitled Bin" design
 * 3. Set currentDesignId so auto-save works immediately
 *
 * Also handles when newDesign() is called (sets currentDesignId to null):
 * - Creates a new design immediately to keep auto-save working
 */

import { useEffect, useRef } from 'react';
import { isOk } from '@/core/result';
import {
  initializeDesigner,
  createNewDesign,
  setActiveDesignId,
} from '@/features/bin-designer/storage/DesignerStorage';
import { useDesignerStore } from '../store';
import { useDesignerRouting } from '@/hooks/useDesignerRouting';
import { upsertRegistryEntry } from '../store/customBinRegistry';

/**
 * Initialize the designer with an active design.
 *
 * Must be called before useAutoSave to ensure currentDesignId is set.
 * Skips initialization if URL contains a design ID (defers to useDesignerUrlSync).
 */
export function useDesignerInit(): void {
  const { designIdFromUrl } = useDesignerRouting();
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
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

    // Skip if we already have a design loaded
    if (currentDesignId) {
      hasInitialized.current = true;
      return;
    }

    // Prevent concurrent initialization
    if (initInProgress.current) return;
    initInProgress.current = true;

    const doInit = async () => {
      if (!hasInitialized.current) {
        // First load - try to restore previous session or create new
        const result = await initializeDesigner();
        if (isOk(result)) {
          const design = result.value;
          loadDesign(design);
          setActiveDesignId(design.id);
          syncToRegistry(design);
        }
      } else {
        // newDesign() was called - create a fresh design
        const result = await createNewDesign();
        if (isOk(result)) {
          const design = result.value;
          // Only set the ID, params are already reset by newDesign()
          setCurrentDesignId(design.id);
          setActiveDesignId(design.id);
          syncToRegistry(design);
        }
      }
      hasInitialized.current = true;
      initInProgress.current = false;
    };

    void doInit();
  }, [designIdFromUrl, currentDesignId, loadDesign, setCurrentDesignId]);
}

function syncToRegistry(design: {
  id: string;
  name: string;
  params: { width: number; depth: number; height: number };
  thumbnail: string | null;
  updatedAt: string;
}): void {
  upsertRegistryEntry({
    id: design.id,
    name: design.name,
    width: design.params.width,
    depth: design.params.depth,
    height: design.params.height,
    thumbnail: design.thumbnail,
    updatedAt: design.updatedAt,
  });
}
