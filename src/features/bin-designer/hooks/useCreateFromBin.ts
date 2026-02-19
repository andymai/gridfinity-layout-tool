/**
 * Hook to initialize the bin designer from URL parameters.
 *
 * Handles the flow when a user clicks "Create Design" on a bin in the Layout Planner:
 * 1. Detects `?createFrom=bin` URL params
 * 2. Initializes designer with the bin's dimensions and name
 * 3. Immediately saves the design and links it to the source bin
 * 4. Shows a success toast when complete
 *
 * URL format: /designer?createFrom=bin&linkBin={binId}&name={name}&width={w}&depth={d}&height={h}
 */

import { useEffect, useRef } from 'react';
import { useDesignerStore } from '../store/designer';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { isFractional } from '@/core/constants';
import { isOk } from '@/core/result';
import { binId } from '@/core/types';
import { saveDesign, setActiveDesignId } from '@/features/bin-designer/storage/DesignerStorage';
import { upsertRegistryEntry } from '@/features/bin-designer/store/customBinRegistry';
import { useLayoutStore } from '@/core/store/layout';

interface CreateFromBinParams {
  createFrom: 'bin';
  linkBin: string;
  name: string;
  width: number;
  depth: number;
  height: number;
}

/**
 * Parse and validate URL parameters for creating a design from a bin.
 * Returns null if params are missing or invalid.
 */
function parseCreateFromBinParams(): CreateFromBinParams | null {
  const urlParams = new URLSearchParams(window.location.search);

  // Check if this is a createFrom=bin request
  if (urlParams.get('createFrom') !== 'bin') {
    return null;
  }

  const linkBin = urlParams.get('linkBin');
  const name = urlParams.get('name');
  const widthStr = urlParams.get('width');
  const depthStr = urlParams.get('depth');
  const heightStr = urlParams.get('height');

  // All params are required
  if (!linkBin || !name || !widthStr || !depthStr || !heightStr) {
    return null;
  }

  const width = parseFloat(widthStr);
  const depth = parseFloat(depthStr);
  const height = parseFloat(heightStr);

  // Validate numeric values
  if (
    Number.isNaN(width) ||
    Number.isNaN(depth) ||
    Number.isNaN(height) ||
    width < 0.5 ||
    depth < 0.5 ||
    height < 1
  ) {
    return null;
  }

  return {
    createFrom: 'bin',
    linkBin,
    name: decodeURIComponent(name),
    width,
    depth,
    height,
  };
}

/**
 * Initialize the designer from URL parameters when creating a design from a bin.
 *
 * This hook:
 * 1. Parses createFrom=bin URL params
 * 2. Initializes designer state with dimensions and name
 * 3. Immediately saves the design to IndexedDB
 * 4. Links the design to the source bin
 * 5. Shows a success toast when complete
 *
 * Runs once on mount and cleans up URL params immediately.
 */
export function useCreateFromBin(): void {
  const handled = useRef(false);
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const updateBin = useLayoutStore((s) => s.updateBin);

  useEffect(() => {
    // Only process once
    if (handled.current) return;
    handled.current = true;

    const urlParams = parseCreateFromBinParams();
    if (!urlParams) return;

    // Clean URL immediately (remove createFrom params)
    const url = new URL(window.location.href);
    url.searchParams.delete('createFrom');
    url.searchParams.delete('linkBin');
    url.searchParams.delete('name');
    url.searchParams.delete('width');
    url.searchParams.delete('depth');
    url.searchParams.delete('height');
    window.history.replaceState({}, '', url.pathname + url.search);

    // Signal useDesignerInit to skip initialization
    // We set pendingBinLink temporarily to prevent race conditions
    useDesignerStore.getState().setPendingBinLink(urlParams.linkBin);

    // Enable half-bin mode if dimensions have fractional values
    const needsHalfBin = isFractional(urlParams.width) || isFractional(urlParams.depth);
    const ui = useDesignerStore.getState().ui;
    if (needsHalfBin && !ui.halfBinMode) {
      useDesignerStore.getState().toggleHalfBinMode();
    }

    // Build the bin params for saving
    const designerState = useDesignerStore.getState();
    const binParams = {
      ...designerState.params,
      width: urlParams.width,
      depth: urlParams.depth,
      height: urlParams.height,
    };

    // Set the dimensions (don't use setParams as it pushes to history)
    // We want a clean slate, not an undo state with default params
    useDesignerStore.setState({
      params: binParams,
      designName: urlParams.name,
      currentDesignId: null, // Will be set after save
      saveStatus: 'saving',
      history: { past: [], future: [] }, // Clear history for fresh start
    });

    // Trigger mesh regeneration
    useDesignerStore.setState((state) => ({
      generation: { ...state.generation, epoch: state.generation.epoch + 1 },
    }));

    // Immediately save the design and link to the bin
    void saveDesign({
      name: urlParams.name,
      params: binParams,
      thumbnail: null, // Mesh is generating, thumbnail captured on next auto-save
      exportFileNameConfig: designerState.exportFileNameConfig,
    }).then((result) => {
      // Clear pendingBinLink regardless of outcome
      useDesignerStore.getState().clearPendingBinLink();

      if (isOk(result)) {
        const design = result.value;

        // Set currentDesignId so auto-save works for subsequent changes
        useDesignerStore.getState().setCurrentDesignId(design.id);
        setActiveDesignId(design.id);
        useDesignerStore.getState().setSaveStatus('saved');

        // Flag that we need to capture thumbnail after mesh generation completes
        useDesignerStore.getState().setNeedsThumbnailUpdate(true);

        // Sync to custom bin registry for layout planner palette
        upsertRegistryEntry({
          id: design.id,
          name: design.name,
          width: binParams.width,
          depth: binParams.depth,
          height: binParams.height,
          updatedAt: design.updatedAt,
        });

        // Link the bin to the new design
        const linkResult = updateBin(binId(urlParams.linkBin), { linkedDesignId: design.id });
        if (isOk(linkResult)) {
          addToast({
            message: t('binDesigner.designCreatedAndLinked'),
            type: 'success',
            duration: 4000,
          });
        } else {
          // Design saved but linking failed
          addToast({
            message: t('binDesigner.designCreatedLinkFailed'),
            type: 'info',
            duration: 5000,
          });
        }
      } else {
        // Save failed - user can continue working, save later via rename
        useDesignerStore.getState().setSaveStatus('error');
        addToast({
          message: t('binDesigner.designCreateFailed'),
          type: 'error',
          duration: 5000,
        });
      }
    });
  }, [t, addToast, updateBin]);
}
