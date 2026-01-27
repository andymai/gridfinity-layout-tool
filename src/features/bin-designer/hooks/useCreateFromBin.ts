/**
 * Hook to initialize the bin designer from URL parameters.
 *
 * Handles the flow when a user clicks "Create Design" on a bin in the Layout Planner:
 * 1. Detects `?createFrom=bin` URL params
 * 2. Initializes designer with the bin's dimensions and name
 * 3. Sets `pendingBinLink` so the bin can be auto-linked after first save
 * 4. Shows an info toast to guide the user
 *
 * URL format: /designer?createFrom=bin&linkBin={binId}&name={name}&width={w}&depth={d}&height={h}
 */

import { useEffect, useRef } from 'react';
import { useDesignerStore } from '../store/designer';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { isFractional } from '@/core/constants';

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
 * This hook runs before useDesignerInit and sets pendingBinLink first to signal
 * that initialization should be skipped. It only runs once on mount and cleans
 * up the URL params immediately.
 */
export function useCreateFromBin(): void {
  const handled = useRef(false);
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    // Only process once
    if (handled.current) return;
    handled.current = true;

    const params = parseCreateFromBinParams();
    if (!params) return;

    // Clean URL immediately (remove createFrom params)
    const url = new URL(window.location.href);
    url.searchParams.delete('createFrom');
    url.searchParams.delete('linkBin');
    url.searchParams.delete('name');
    url.searchParams.delete('width');
    url.searchParams.delete('depth');
    url.searchParams.delete('height');
    window.history.replaceState({}, '', url.pathname + url.search);

    // IMPORTANT: Set pendingBinLink FIRST to signal useDesignerInit to skip
    // This must happen before any other state changes
    useDesignerStore.getState().setPendingBinLink(params.linkBin);

    // Enable half-bin mode if dimensions have fractional values
    const needsHalfBin = isFractional(params.width) || isFractional(params.depth);
    const ui = useDesignerStore.getState().ui;
    if (needsHalfBin && !ui.halfBinMode) {
      useDesignerStore.getState().toggleHalfBinMode();
    }

    // Set the dimensions (don't use setParams as it pushes to history)
    // We want a clean slate, not an undo state with default params
    useDesignerStore.setState((state) => ({
      params: {
        ...state.params,
        width: params.width,
        depth: params.depth,
        height: params.height,
      },
      designName: params.name,
      currentDesignId: null, // New design, not saved yet
      saveStatus: 'idle',
      history: { past: [], future: [] }, // Clear history for fresh start
    }));

    // Trigger mesh regeneration
    useDesignerStore.setState((state) => ({
      generation: { ...state.generation, epoch: state.generation.epoch + 1 },
    }));

    // Show info toast
    addToast({
      message: t('binDesigner.creatingFromBin', { name: params.name }),
      type: 'info',
      duration: 5000,
    });
  }, [t, addToast]);
}
