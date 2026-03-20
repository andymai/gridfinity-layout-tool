/**
 * URL ↔ Designer store synchronization hook.
 *
 * Handles two directions of sync:
 * 1. URL → Store: On mount or popstate, if URL has ?id=xyz, load that design
 * 2. Store → URL: When currentDesignId changes (e.g., auto-save creates new),
 *    update URL silently (replaceState)
 *
 * This enables:
 * - Deep linking to specific designs (/designer?id=abc123)
 * - Browser back/forward navigation between designs
 * - URL stays in sync after auto-save without polluting history
 */

import { useEffect, useRef } from 'react';
import { isOk, getUserMessage } from '@/core/result';
import { designId } from '@/core/types';
import { loadDesign } from '@/features/bin-designer/storage/DesignerStorage';
import { useDesignerStore } from '../store';
import { useDesignerRouting } from '@/shared/hooks/useDesignerRouting';
import { useToastStore } from '@/core/store/toast';

/**
 * Synchronizes the designer's current design with the URL.
 * Must be called inside the DesignerPage component.
 */
export function useDesignerUrlSync(): void {
  const { designIdFromUrl, syncUrlToDesign } = useDesignerRouting();
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  const storeLoadDesign = useDesignerStore((s) => s.loadDesign);
  const addToast = useToastStore((s) => s.addToast);

  // Track whether we're handling initial mount vs ongoing changes
  const mountedRef = useRef(false);
  // Track whether we triggered a design load ourselves (to avoid re-sync loops)
  const loadingFromUrlRef = useRef(false);
  // Track last known URL ID to avoid redundant loads
  const lastUrlIdRef = useRef<string | null>(designIdFromUrl);

  // Direction 1: URL → Store (load design when URL changes)
  useEffect(() => {
    // Skip if the URL ID hasn't actually changed
    if (designIdFromUrl === lastUrlIdRef.current && mountedRef.current) return;
    lastUrlIdRef.current = designIdFromUrl;

    if (!designIdFromUrl) {
      mountedRef.current = true;
      return;
    }

    // Don't reload if we're already viewing this design
    if (designIdFromUrl === currentDesignId) {
      mountedRef.current = true;
      return;
    }

    loadingFromUrlRef.current = true;

    void loadDesign(designId(designIdFromUrl)).then((result) => {
      if (isOk(result)) {
        storeLoadDesign(result.value);
      } else {
        addToast({ message: getUserMessage(result.error), type: 'error', duration: 4000 });
        syncUrlToDesign(null);
      }
      loadingFromUrlRef.current = false;
      mountedRef.current = true;
    });
  }, [designIdFromUrl, currentDesignId, storeLoadDesign, addToast, syncUrlToDesign]);

  // Direction 2: Store → URL (sync URL when design ID changes)
  useEffect(() => {
    // Skip initial mount (wait for URL load to complete first)
    if (!mountedRef.current) return;
    // Skip if we're the ones who just loaded from URL
    if (loadingFromUrlRef.current) return;
    // Skip if already in sync
    if (currentDesignId === lastUrlIdRef.current) return;

    lastUrlIdRef.current = currentDesignId;
    syncUrlToDesign(currentDesignId);
  }, [currentDesignId, syncUrlToDesign]);
}
